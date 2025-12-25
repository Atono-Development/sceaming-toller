import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";
import { useAuth } from "./AuthContext";

export interface Team {
  id: string;
  name: string;
  description: string;
  league: string;
  season: string;
  isActive: boolean;
  membership?: {
    role: string;
  };
}

interface TeamContextType {
  teams: Team[];
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  isLoading: boolean;
  refreshTeams: () => Promise<void>;
  isAdmin: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeamState] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeams = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.get("/teams");
      const fetchedTeams = response.data;
      setTeams(fetchedTeams);
      
      const savedTeamId = localStorage.getItem("currentTeamId");
      if (savedTeamId) {
        const team = fetchedTeams.find((t: Team) => t.id === savedTeamId);
        if (team) {
          setCurrentTeamState(team);
        } else if (fetchedTeams.length > 0) {
          setCurrentTeam(fetchedTeams[0]);
        }
      } else if (fetchedTeams.length > 0) {
        setCurrentTeam(fetchedTeams[0]);
      } else {
        setCurrentTeamState(null);
      }
    } catch (error) {
      console.error("Failed to fetch teams", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [isAuthenticated]);

  const setCurrentTeam = (team: Team | null) => {
    setCurrentTeamState(team);
    if (team) {
      localStorage.setItem("currentTeamId", team.id);
    } else {
      localStorage.removeItem("currentTeamId");
    }
  };

  return (
    <TeamContext.Provider
      value={{
        teams,
        currentTeam,
        setCurrentTeam,
        isLoading,
        refreshTeams: fetchTeams,
        isAdmin: currentTeam?.membership?.role === "admin",
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};

export const useTeamContext = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeams must be used within a TeamProvider");
  }
  return context;
};
