import { assertApiBaseUrl } from "../config/api";

const isFormDataBody = (body: BodyInit | null | undefined): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

const buildApiUrl = (baseUrl: string, endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
};

/**
 * Centralized API helper using environment-based base URL.
 * Ensures consistent request handling across the app.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = assertApiBaseUrl();

  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type") && !isFormDataBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(baseUrl, endpoint), {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
