// Single source of truth for the backend's HTTP/socket base URLs. Expo
// inlines EXPO_PUBLIC_* vars at build time (same pattern as the web app's
// VITE_API_BASE_URL). localhost will NOT reach the backend from a physical
// device or a simulator that isn't running on the same machine as the
// backend — use your machine's LAN IP (or a tunnel) in .env.
const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const rawSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

export const API_BASE_URL = rawApiBaseUrl ? rawApiBaseUrl.replace(/\/+$/, "") : "";
export const SOCKET_URL = rawSocketUrl ? rawSocketUrl.replace(/\/+$/, "") : "";

export const assertApiBaseUrl = (): string => {
  if (!API_BASE_URL) {
    throw new Error(
      "API base URL is not defined. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env (see .env.example)."
    );
  }

  return API_BASE_URL;
};

export const assertSocketUrl = (): string => {
  if (!SOCKET_URL) {
    throw new Error(
      "Socket URL is not defined. Set EXPO_PUBLIC_SOCKET_URL in mobile/.env (see .env.example)."
    );
  }

  return SOCKET_URL;
};
