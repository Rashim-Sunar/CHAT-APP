const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

// Keep one source of truth for API URL and normalize trailing slash.
export const API_BASE_URL = rawApiBaseUrl ? rawApiBaseUrl.replace(/\/+$/, "") : "";

export const assertApiBaseUrl = (): string => {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not defined. Set VITE_API_BASE_URL in your env file.");
  }

  return API_BASE_URL;
};
