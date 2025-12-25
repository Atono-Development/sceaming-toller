import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Game API
export const createGame = async (teamId: string, gameData: any) => {
  const response = await api.post(`/teams/${teamId}/games`, gameData);
  return response.data;
};

export const getTeamGames = async (teamId: string) => {
  const response = await api.get(`/teams/${teamId}/games`);
  return response.data;
};

export default api;
