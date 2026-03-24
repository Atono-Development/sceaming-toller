import api from "../lib/api";

export const uploadTeamLogo = async (teamId: string, file: File) => {
  const formData = new FormData();
  formData.append("logo", file);

  const response = await api.post(`/teams/${teamId}/logo`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const deleteTeamLogo = async (teamId: string) => {
  const response = await api.delete(`/teams/${teamId}/logo`);
  return response.data;
};
