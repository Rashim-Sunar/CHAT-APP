// Ported from frontend/src/context/SocketContext.tsx's connection logic.
// No cookie/auth header involved — confirmed via backend/socket/socket.ts,
// the handshake trusts `query.userId` directly, same as the web client.
import { io, type Socket } from "socket.io-client";
import { assertSocketUrl } from "../config/env";
import type { ClientToServerEvents, ServerToClientEvents } from "../types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const createSocket = (userId: string): AppSocket =>
  io(assertSocketUrl(), {
    query: { userId },
    transports: ["websocket"],
  }) as AppSocket;
