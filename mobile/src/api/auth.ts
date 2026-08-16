import { apiFetch } from "./client";
import type { AuthResponse, Gender } from "../types";

export interface SignupPayload {
  email: string;
  userName: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const signup = (payload: SignupPayload): Promise<AuthResponse> =>
  apiFetch<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(payload) });

export const login = (payload: LoginPayload): Promise<AuthResponse> =>
  apiFetch<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) });

export const logout = (): Promise<{ status: string; message?: string }> =>
  apiFetch("/auth/logout", { method: "POST" });

export const fetchCurrentSession = (): Promise<AuthResponse | null> =>
  apiFetch<AuthResponse>("/auth/me").catch(() => null);
