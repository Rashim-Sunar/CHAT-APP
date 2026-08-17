import { apiFetch } from "./client";
import type { User } from "../types";

// No dedicated contact-search endpoint exists yet — this is the same flat
// user list the web app used before it moved to conversation-centric APIs.
export const listUsers = async (): Promise<User[]> => {
  const response = await apiFetch<{ status: string; data?: { users: User[] } }>("/users");
  return response.data?.users || [];
};

export const updateUserName = async (userName: string): Promise<User> => {
  const response = await apiFetch<{ status: string; message?: string; data?: { user: User } }>(
    "/users/update-name",
    { method: "PATCH", body: JSON.stringify({ userName }) }
  );

  if (!response.data?.user) {
    throw new Error(response.message || "Failed to update username");
  }

  return response.data.user;
};
