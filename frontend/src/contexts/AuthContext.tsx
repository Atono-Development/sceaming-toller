import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import api from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  auth0Id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (redirectPath?: string) => void;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  syncError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    isAuthenticated, 
    isLoading: auth0IsLoading, 
    user: auth0User, 
    loginWithRedirect, 
    logout: auth0Logout,
    getAccessTokenSilently
  } = useAuth0();

  const [localUser, setLocalUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncUser = async () => {
      if (isAuthenticated && auth0User) {
        try {
          const accessToken = await getAccessTokenSilently();
          if (!isMounted) return;

          setToken(accessToken);
          
          // Set the token on the API client globally so all requests use it
          api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

          const syncResponse = await api.post("/auth/sync", {
            email: auth0User.email,
            name: auth0User.name || auth0User.nickname || auth0User.email,
          });

          if (isMounted) {
            setLocalUser(syncResponse.data.user);
            setSyncError(null);
          }
        } catch (error: any) {
          console.error("Failed to sync Auth0 user with local backend", error);
          if (isMounted) {
            setSyncError(error?.response?.data || error?.message || "Unknown sync error");
          }
        } finally {
          if (isMounted) setHasAttemptedSync(true);
        }
      } else if (!isAuthenticated && !auth0IsLoading) {
        setToken(null);
        setLocalUser(null);
        if (isMounted) setHasAttemptedSync(true);
        delete api.defaults.headers.common["Authorization"];
      }
    };

    syncUser();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, auth0IsLoading, auth0User, getAccessTokenSilently]);

  const login = (redirectPath?: string) => {
    loginWithRedirect({
      appState: { returnTo: redirectPath || window.location.pathname }
    });
  };

  const logout = () => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  };

  // The app is "loading" if either Auth0 is loading its SDK state, OR we are syncing with the backend
  const isLoading = auth0IsLoading || (isAuthenticated && !hasAttemptedSync);
  // The app is "authenticated" ONLY after we have successfully synced the local DB user
  const isFullyAuthenticated = isAuthenticated && !!localUser;

  return (
    <AuthContext.Provider
      value={{
        user: localUser,
        token,
        login,
        logout,
        isLoading,
        isAuthenticated: isFullyAuthenticated,
        syncError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
