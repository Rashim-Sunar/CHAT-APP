import { assertApiBaseUrl } from "../config/api";

// Thrown for any non-OK response; carries the HTTP status for reliable branching.
export class ApiFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
  }
}

// Shared fetch wrapper for the client: normalizes base URL, request headers,
// credentials, and response handling so callers do not repeat transport logic.
const isFormDataBody = (body: BodyInit | null | undefined): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

// Parses the backend's JSON error body into readable prose; falls back to
// raw text for non-JSON responses.
const extractErrorMessage = (rawBody: string, statusText: string): string => {
  if (!rawBody) return statusText || "Request failed";

  try {
    const parsed = JSON.parse(rawBody) as { message?: string; error?: string };
    return parsed.message || parsed.error || rawBody;
  } catch {
    return rawBody;
  }
};

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

    throw new ApiFetchError(response.status, extractErrorMessage(errorText, response.statusText));
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
