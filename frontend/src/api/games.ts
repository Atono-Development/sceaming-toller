import api from "../lib/api";

export interface Game {
  id: string;
  teamId: string;
  date: string;
  time: string;
  location: string;
  opposingTeam: string;
  finalScore?: number;
  opponentScore?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  teamMemberId: string;
  gameId: string;
  status: string; // "going", "not_going", "maybe"
  updatedAt: string;
  teamMember?: {
    id: string;
    user?: {
      name: string;
      email: string;
    };
  };
}

export interface BattingOrder {
  id: string;
  gameId: string;
  teamMemberId: string;
  battingPosition: number;
  isGenerated: boolean;
  createdAt: string;
  teamMember?: {
    user?: {
      name: string;
    };
  };
}

export interface FieldingLineup {
  id: string;
  gameId: string;
  inning: number;
  teamMemberId: string;
  position: string;
  isGenerated: boolean;
  createdAt: string;
  teamMember?: {
    user?: {
      name: string;
    };
  };
}

export const getTeamGames = async (teamId: string) => {
  const response = await api.get<Game[]>(`/teams/${teamId}/games`);
  return response.data;
};

export const getGame = async (teamId: string, gameId: string) => {
  const response = await api.get<Game>(`/teams/${teamId}/games/${gameId}`);
  return response.data;
};

export const getAttendance = async (teamId: string, gameId: string) => {
  const response = await api.get<Attendance[]>(
    `/teams/${teamId}/games/${gameId}/attendance`
  );
  return response.data;
};

export const updateAttendance = async (
  teamId: string,
  gameId: string,
  status: string
) => {
  const response = await api.put(
    `/teams/${teamId}/games/${gameId}/attendance`,
    { status }
  );
  return response.data;
};

export const getBattingOrder = async (teamId: string, gameId: string) => {
  const response = await api.get<BattingOrder[]>(
    `/teams/${teamId}/games/${gameId}/batting-order`
  );
  return response.data;
};

export const getFieldingLineup = async (teamId: string, gameId: string) => {
  const response = await api.get<FieldingLineup[]>(
    `/teams/${teamId}/games/${gameId}/fielding`
  );
  return response.data;
};

export const generateCompleteFieldingLineup = async (
  teamId: string,
  gameId: string
) => {
  const response = await api.post<FieldingLineup[]>(
    `/teams/${teamId}/games/${gameId}/fielding/generate-complete`
  );
  return response.data;
};

export const updateGame = async (
  teamId: string,
  gameId: string,
  gameData: Partial<Game>
) => {
  const response = await api.put(`/teams/${teamId}/games/${gameId}`, gameData);
  return response.data;
};

export const deleteGame = async (teamId: string, gameId: string) => {
  const response = await api.delete(`/teams/${teamId}/games/${gameId}`);
  return response.data;
};

export const updateGameScore = async (
  teamId: string,
  gameId: string,
  finalScore: number,
  opponentScore: number
) => {
  const response = await api.put(`/teams/${teamId}/games/${gameId}/score`, {
    finalScore,
    opponentScore,
  });
  return response.data;
};

export interface InningScore {
  inning: number;
  teamScore: number;
  opponentScore: number;
}

export const updateInningScores = async (
  teamId: string,
  gameId: string,
  inningScores: InningScore[]
) => {
  const response = await api.put(`/teams/${teamId}/games/${gameId}/innings`, {
    inningScores,
  });
  return response.data;
};
