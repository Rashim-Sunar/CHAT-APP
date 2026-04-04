import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthContextValue, AuthResponse } from "../types";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStoredAuthUser = (): AuthResponse | null => {
  try {
    const storedUser = localStorage.getItem("chat-user");
    return storedUser ? (JSON.parse(storedUser) as AuthResponse) : null;
  } catch {
    return null;
  }
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

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };