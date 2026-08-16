// Ported from frontend/src/Utils/apiFetch.ts. Two RN-specific differences:
// 1. No `credentials: "include"` — that's a browser fetch concept; RN's
//    native networking layer persists cookies on its own (assuming Spike 1
//    passed — see webcryptoPolyfill.ts's sibling note in README). If Spike 1
//    failed, swap the plain `fetch` call below for a `fetch-cookie`-wrapped
//    client — that's the only line this file should need to change.
// 2. 401 handling uses a plain listener registry instead of
//    window.dispatchEvent(CustomEvent) — RN's `window` doesn't reliably
//    support arbitrary CustomEvent dispatch the way a DOM window does.
import { assertApiBaseUrl } from "../config/env";

export class ApiFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

// AuthContext subscribes to this instead of a "auth:unauthorized" DOM event.
export const onUnauthorized = (listener: UnauthorizedListener): (() => void) => {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
};

const isFormDataBody = (body: BodyInit | null | undefined): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

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
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
};

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = assertApiBaseUrl();

  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type") && !isFormDataBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(baseUrl, endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener());
    }

    throw new ApiFetchError(response.status, extractErrorMessage(errorText, response.statusText));
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
