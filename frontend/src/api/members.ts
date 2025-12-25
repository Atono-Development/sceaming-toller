import api from "../lib/api";

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  gender: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
  user?: {
    name: string;
    email: string;
  };
}

export const getTeamMembers = async (teamId: string) => {
  const response = await api.get<TeamMember[]>(`/teams/${teamId}/members`);
  return response.data;
};

export const removeMember = async (teamId: string, memberId: string) => {
  const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
  return response.data;
};
