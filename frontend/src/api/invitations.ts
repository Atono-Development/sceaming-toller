import api from "../lib/api";

export interface Invitation {
  id: string;
  teamId: string;
  email: string;
  token: string;
  role: string;
  expiresAt: string;
  acceptedAt?: string;
  team?: {
    name: string;
  };
}

export const inviteMember = async (teamId: string, email: string, role: string) => {
  const response = await api.post<Invitation>(`/teams/${teamId}/invitations`, { email, role });
  return response.data;
};

export const getInvitation = async (token: string) => {
  const response = await api.get<Invitation>(`/invitations/${token}`);
  return response.data;
};

export const acceptInvitation = async (token: string) => {
  const response = await api.post(`/invitations/${token}/accept`);
  return response.data;
};
