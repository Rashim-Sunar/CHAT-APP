import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthContextValue, AuthResponse } from "../types";
import useConversation from "../zustand/useConversation";
import { assertApiBaseUrl } from "../config/api";

// ----------------------------------------
// @file   Auth-Context.tsx
// @desc   Centralized authentication/session state with cookie revalidation
// ----------------------------------------

// Shared auth context consumed by hooks/components that require session identity.
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Reads cached auth state from localStorage.
 * Corrupted cache is treated as an unauthenticated state to avoid trusting
 * malformed client data.
 */
const readStoredAuthUser = (): AuthResponse | null => {
  try {
    const storedUser = localStorage.getItem("chat-user");
    return storedUser ? (JSON.parse(storedUser) as AuthResponse) : null;
  } catch {
    return null;
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Validates the current cookie session against the backend source of truth.
 * Returns null for any non-valid response shape to keep caller logic uniform.
 */
const fetchCurrentSession = async (): Promise<AuthResponse | null> => {
  // auth/me is authoritative for server-side session validity.
  const response = await fetch(`${assertApiBaseUrl()}/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const data = (await response.json()) as AuthResponse;
  if (data.status !== "success" || !data.data?.user?._id) {
    return null;
  }

  return data;
};

/**
 * Consumer hook with provider guard to prevent silent undefined usage.
 */
export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within AuthContextProvider");
  }

  return context;
};

interface AuthContextProviderProps {
  children: ReactNode;
}

export const AuthContextProvider = ({ children }: AuthContextProviderProps) => {
  // Optimistic hydration from cache, followed by authoritative server validation.
  const [authUser, setAuthUser] = useState<AuthResponse | null>(readStoredAuthUser);
  const [loading, setLoading] = useState(true);
  const userId = authUser?.data?.user?._id;
  const authUserRef = useRef<AuthResponse | null>(authUser);
  // Guards against overlapping revalidation requests during rapid event bursts.
  const sessionCheckInFlightRef = useRef(false);

  useEffect(() => {
    // Keeps event handlers aligned with latest auth state without re-subscribing.
    authUserRef.current = authUser;
  }, [authUser]);

  /**
   * Applies auth state and persistence atomically through a single write path.
   */
  const applyAuthState = (nextAuthUser: AuthResponse | null): void => {
    if (nextAuthUser?.data?.user?._id) {
      localStorage.setItem("chat-user", JSON.stringify(nextAuthUser));
      setAuthUser(nextAuthUser);
      return;
    }

    localStorage.removeItem("chat-user");
    setAuthUser(null);
  };

  /**
   * Revalidates server session and updates local state.
   * Optional short retries smooth out startup/cookie propagation races.
   */
  const validateSession = async (retryDelaysMs: number[] = []): Promise<void> => {
    if (sessionCheckInFlightRef.current) return;

    sessionCheckInFlightRef.current = true;
    setLoading(true);

    try {
      let sessionAuthUser = await fetchCurrentSession().catch(() => null);

      // Covers brief races where session cookies are not yet consistently readable.
      for (const delay of retryDelaysMs) {
        if (sessionAuthUser) break;
        await sleep(delay);
        sessionAuthUser = await fetchCurrentSession().catch(() => null);
      }

      applyAuthState(sessionAuthUser);
    } finally {
      sessionCheckInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    // Startup strategy: if cache exists, validate it; otherwise clear state immediately.
    const storedAuth = readStoredAuthUser();

    if (!storedAuth?.data?.user?._id) {
      applyAuthState(null);
      setLoading(false);
      return;
    }

    void validateSession([250, 450]);
  }, []);

  useEffect(() => {
    // apiFetch dispatches this event on 401 responses from any API consumer.
    // Central handling prevents scattered per-hook auth reset logic.
    const handleUnauthorized = () => {
      if (!authUserRef.current?.data?.user?._id) {
        applyAuthState(null);
        setLoading(false);
        return;
      }

      void validateSession([250, 450]);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    // Clears conversation-scoped client state when user identity changes.
    useConversation.getState().resetConversationState();
  }, [userId]);

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };