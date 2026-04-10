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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

const fetchCurrentSession = async (): Promise<AuthResponse | null> => {
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
  const [authUser, setAuthUser] = useState<AuthResponse | null>(readStoredAuthUser);
  const [loading, setLoading] = useState(true);
  const userId = authUser?.data?.user?._id;
  const authUserRef = useRef<AuthResponse | null>(authUser);
  const sessionCheckInFlightRef = useRef(false);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  const applyAuthState = (nextAuthUser: AuthResponse | null): void => {
    if (nextAuthUser?.data?.user?._id) {
      localStorage.setItem("chat-user", JSON.stringify(nextAuthUser));
      setAuthUser(nextAuthUser);
      return;
    }

    localStorage.removeItem("chat-user");
    setAuthUser(null);
  };

  const validateSession = async (retryDelaysMs: number[] = []): Promise<void> => {
    if (sessionCheckInFlightRef.current) return;

    sessionCheckInFlightRef.current = true;
    setLoading(true);

    try {
      let sessionAuthUser = await fetchCurrentSession().catch(() => null);

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
    const storedAuth = readStoredAuthUser();

    if (!storedAuth?.data?.user?._id) {
      applyAuthState(null);
      setLoading(false);
      return;
    }

    void validateSession([250, 450]);
  }, []);

  useEffect(() => {
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
    useConversation.getState().resetConversationState();
  }, [userId]);

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };