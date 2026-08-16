// Ported from frontend/src/context/SocketContext.tsx, plus an AppState
// listener the web version doesn't need: RN suspends JS when backgrounded,
// which silently drops the socket connection — without this, the app would
// stop receiving messages after being backgrounded until manually killed
// and reopened.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuthContext } from "./AuthContext";
import { createSocket, type AppSocket } from "../socket/socketClient";

interface SocketContextValue {
  socket: AppSocket | null;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const useSocketContext = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocketContext must be used within SocketContextProvider");
  }
  return context;
};

interface SocketContextProviderProps {
  children: ReactNode;
}

export const SocketContextProvider = ({ children }: SocketContextProviderProps) => {
  const { authUser } = useAuthContext();
  const userId = authUser?.data?.user?._id;
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const socketRef = useRef<AppSocket | null>(null);

  useEffect(() => {
    if (!userId) {
      socketRef.current?.close();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers([]);
      return;
    }

    const nextSocket = createSocket(userId);
    socketRef.current = nextSocket;
    setSocket(nextSocket);

    nextSocket.on("getOnlineUsers", (users) => setOnlineUsers(users));

    return () => {
      nextSocket.off("getOnlineUsers");
      nextSocket.close();
      socketRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== "active") return;

      const current = socketRef.current;
      if (current && !current.connected) {
        current.connect();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};
