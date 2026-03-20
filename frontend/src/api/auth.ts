import api from "../lib/api";
import type { User } from "../contexts/AuthContext";

export const updateMe = async (name: string): Promise<User> => {
  const response = await api.put("/auth/me", { name });
  return response.data;
};
