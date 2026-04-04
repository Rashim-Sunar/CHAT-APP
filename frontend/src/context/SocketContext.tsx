import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { useAuthContext } from "./Auth-Context";
import type { AppSocket, SocketContextValue } from "../types";

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
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { authUser } = useAuthContext();
  const userId = authUser?.data?.user?._id;

  useEffect(() => {
    if (userId) {
      const nextSocket = io("http://localhost:8000", {
        query: {
          userId,
        },
      }) as AppSocket;

      setSocket(nextSocket);

      nextSocket.on("getOnlineUsers", (users) => {
        setOnlineUsers(users);
      });

      return () => {
        nextSocket.off("getOnlineUsers");
        nextSocket.close();
      };
    }

    setOnlineUsers([]);
    setSocket((prevSocket) => {
      prevSocket?.close();
      return null;
    });

    return undefined;
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext };