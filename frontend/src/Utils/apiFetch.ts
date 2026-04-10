import { assertApiBaseUrl } from "../config/api";

// Shared fetch wrapper for the client: normalizes base URL, request headers,
// credentials, and response handling so callers do not repeat transport logic.
const isFormDataBody = (body: BodyInit | null | undefined): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

const buildApiUrl = (baseUrl: string, endpoint: string): string => {
  // Keep endpoint joining predictable regardless of whether callers include "/".
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
};

/**
 * Centralized API helper using the environment-based base URL.
 * It also applies JSON defaults, preserves cookies, and returns typed data.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = assertApiBaseUrl();

  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;

  // Do not force JSON headers when sending multipart form data.
  if (hasBody && !headers.has("Content-Type") && !isFormDataBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(baseUrl, endpoint), {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    // Surface the backend response body to make debugging API failures easier.
    const errorText = await response.text();

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("auth:unauthorized", {
          detail: {
            status: response.status,
            message: errorText,
          },
        })
      );
    }

    throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
  }

  // Empty-success responses should resolve cleanly instead of forcing JSON parsing.
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  // Some endpoints intentionally return no JSON payload.
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
