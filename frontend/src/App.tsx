import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TeamProvider } from "./contexts/TeamContext";
import LoginPage from "./pages/auth/LoginPage";
import Dashboard from "./pages/Dashboard";
import PlayerDashboard from "./pages/PlayerDashboard";
import { CreateTeamPage } from "./pages/teams/CreateTeamPage";
import { GamesPage } from "./pages/teams/GamesPage";
import { CreateGamePage } from "./pages/teams/CreateGamePage";
import { EditGamePage } from "./pages/teams/EditGamePage";
import { ScoreGamePage } from "./pages/teams/ScoreGamePage";
import { RosterPage } from "./pages/teams/RosterPage";
import LineupPage from "./pages/teams/LineupPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AdminTeamsPage } from "./pages/admin/AdminTeamsPage";
import Layout from "./components/Layout";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Save the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
};

const CallbackRoute = () => {
  const { isLoading, isAuthenticated, syncError, logout } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (syncError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600">Login Sync Failed</h1>
        <p className="text-gray-700 max-w-md">{syncError}</p>
        <button 
          onClick={logout} 
          className="px-6 py-2 bg-slate-800 text-white rounded font-medium mt-4 hover:bg-slate-700 transition"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN || "";
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || "";
  // Default to the origin + /api if no audience is explicitly set
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || (window.location.origin + "/api");

  const onRedirectCallback = (appState: any) => {
    navigate(appState?.returnTo || "/");
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin + "/callback",
        audience: audience,
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthProvider>
        <TeamProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/callback" element={<CallbackRoute />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/create"
                element={
                  <ProtectedRoute>
                    <CreateTeamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games"
                element={
                  <ProtectedRoute>
                    <GamesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/roster"
                element={
                  <ProtectedRoute>
                    <RosterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/lineup"
                element={
                  <ProtectedRoute>
                    <LineupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/profile"
                element={
                  <ProtectedRoute>
                    <PlayerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/new"
                element={
                  <ProtectedRoute>
                    <CreateGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/:gameId/edit"
                element={
                  <ProtectedRoute>
                    <EditGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/:gameId/score"
                element={
                  <ProtectedRoute>
                    <ScoreGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitations/:token"
                element={
                  <ProtectedRoute>
                    <AcceptInvitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/teams"
                element={
                  <ProtectedRoute>
                    <AdminTeamsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TeamProvider>
      </AuthProvider>
    </Auth0Provider>
  );
}

export default App;
