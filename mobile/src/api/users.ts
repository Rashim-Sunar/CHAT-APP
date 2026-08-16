import { apiFetch } from "./client";
import type { User } from "../types";

// No dedicated contact-search endpoint exists yet — this is the same flat
// user list the web app used before it moved to conversation-centric APIs.
export const listUsers = async (): Promise<User[]> => {
  const response = await apiFetch<{ status: string; data?: { users: User[] } }>("/users");
  return response.data?.users || [];
};
