// Ported from frontend/src/context/Auth-Context.tsx, simplified: the web
// version optimistically hydrates from a cached user object in localStorage
// before revalidating. Skipped here — SecureStore's per-value size limit
// (see secureStorage.ts) makes caching a full user object needless risk for
// a UX nicety, so this just shows a loading state until GET /auth/me
// resolves on launch. Session persistence itself is still cookie-based,
// same as web (see Spike 1) — there is no local token to manage.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentSession } from "../api/auth";
import { onUnauthorized } from "../api/client";
import useConversationStore from "../store/useConversationStore";
import type { AuthResponse } from "../types";

interface AuthContextValue {
  authUser: AuthResponse | null;
  setAuthUser: (next: AuthResponse | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
  const [authUser, setAuthUserState] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = authUser?.data?.user?._id;

  const setAuthUser = useCallback((next: AuthResponse | null) => {
    setAuthUserState(next?.data?.user?._id ? next : null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchCurrentSession().then((session) => {
      if (cancelled) return;
      setAuthUser(session);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [setAuthUser]);

  useEffect(() => onUnauthorized(() => setAuthUser(null)), [setAuthUser]);

  useEffect(() => {
    useConversationStore.getState().resetConversationState();
  }, [userId]);

  return <AuthContext.Provider value={{ authUser, setAuthUser, loading }}>{children}</AuthContext.Provider>;
};
