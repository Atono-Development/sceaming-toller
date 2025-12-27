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

export interface TeamMemberPreference {
  id: string;
  teamMemberId: string;
  position: string;
  preferenceRank: number;
}

export const getTeamMembers = async (teamId: string) => {
  const response = await api.get<TeamMember[]>(`/teams/${teamId}/members`);
  return response.data;
};

export const removeMember = async (teamId: string, memberId: string) => {
  const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
  return response.data;
};

export const getMyPreferences = async (teamId: string) => {
  const response = await api.get<TeamMemberPreference[]>(
    `/teams/${teamId}/members/me/preferences`
  );
  return response.data;
};

export const updateMyPreferences = async (
  teamId: string,
  preferences: { position: string; preferenceRank: number }[]
) => {
  const response = await api.put(`/teams/${teamId}/members/me/preferences`, {
    preferences,
  });
  return response.data;
};

export interface MemberWithPreferences {
  id: string;
  name: string;
  email: string;
  role: string;
  gender: string;
  preferences: TeamMemberPreference[];
}

export const getAllTeamMemberPreferences = async (teamId: string) => {
  const response = await api.get<MemberWithPreferences[]>(
    `/teams/${teamId}/members/preferences`
  );
  return response.data;
};

export const getMyTeamMemberInfo = async (teamId: string) => {
  const response = await api.get<TeamMember>(`/teams/${teamId}/members/me`);
  return response.data;
};

export const updateMyPitcherStatus = async (
  teamId: string,
  isPitcher: boolean
) => {
  const response = await api.put(`/teams/${teamId}/members/me/pitcher`, {
    isPitcher,
  });
  return response.data;
};
