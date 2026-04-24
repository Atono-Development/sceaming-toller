import api from "../lib/api";
import type { User } from "../contexts/AuthContext";

export const updateMe = async (name: string, optOutReminders: boolean, whapiToken?: string): Promise<User> => {
  const response = await api.put("/auth/me", { name, optOutReminders, whapiToken });
  return response.data;
};
