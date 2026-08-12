// ----------------------------------------
// @file   Utils/callSession.ts
// @desc   In-memory (not persisted) state for live call sessions — mirrors
//         the ephemeral userSocketMap in socket/socket.ts. A call session
//         only matters while it's happening; once everyone has left, the
//         durable record of it is the call_log Message written separately.
// ----------------------------------------

import type { CallType } from '../models/messageModel.js';

export const MAX_CALL_PARTICIPANTS = 6;
export const CALL_RING_TIMEOUT_MS = 45_000;

export interface CallParticipant {
  userId: string;
  socketId: string;
  joinedAt: number;
}

export interface CallSession {
  conversationId: string;
  conversationType: 'direct' | 'group';
  callType: CallType;
  // One slot per userId, not per device/socket — a user joining from a
  // second tab doesn't count as a second mesh participant.
  participants: Map<string, CallParticipant>;
  // Set the moment a 2nd participant ever joins; distinguishes a call that
  // connected-then-ended from one that rang out unanswered (missed).
  connectedAt?: number;
  ringTimer?: NodeJS.Timeout;
}

const sessionsByConversationId = new Map<string, CallSession>();
// Reverse index for O(1) cleanup when a socket disconnects mid-call.
const conversationIdBySocketId = new Map<string, string>();

export const getSession = (conversationId: string): CallSession | undefined =>
  sessionsByConversationId.get(conversationId);

export const createSession = (
  conversationId: string,
  conversationType: 'direct' | 'group',
  callType: CallType
): CallSession => {
  const session: CallSession = {
    conversationId,
    conversationType,
    callType,
    participants: new Map(),
  };
  sessionsByConversationId.set(conversationId, session);
  return session;
};

type AddParticipantResult = { ok: true } | { ok: false; reason: 'full' };

export const addParticipant = (
  session: CallSession,
  userId: string,
  socketId: string
): AddParticipantResult => {
  const alreadyIn = session.participants.has(userId);
  if (!alreadyIn && session.participants.size >= MAX_CALL_PARTICIPANTS) {
    return { ok: false, reason: 'full' };
  }

  session.participants.set(userId, { userId, socketId, joinedAt: Date.now() });
  conversationIdBySocketId.set(socketId, session.conversationId);

  if (session.participants.size >= 2 && !session.connectedAt) {
    session.connectedAt = Date.now();
  }

  return { ok: true };
};

// Removes by userId (used for explicit call:leave) — clears every socketId
// this user may have registered under this session along the way.
export const removeParticipant = (session: CallSession, userId: string): void => {
  const participant = session.participants.get(userId);
  if (participant) {
    conversationIdBySocketId.delete(participant.socketId);
  }
  session.participants.delete(userId);
};

// Removes by socketId (used for disconnect cleanup, where we may not know
// which userId owned that socket without this reverse lookup).
export const removeParticipantBySocketId = (
  socketId: string
): { session: CallSession; userId: string } | null => {
  const conversationId = conversationIdBySocketId.get(socketId);
  if (!conversationId) return null;

  const session = sessionsByConversationId.get(conversationId);
  conversationIdBySocketId.delete(socketId);
  if (!session) return null;

  const entry = Array.from(session.participants.values()).find((p) => p.socketId === socketId);
  if (!entry) return null;

  session.participants.delete(entry.userId);
  return { session, userId: entry.userId };
};

export const endSession = (conversationId: string): void => {
  const session = sessionsByConversationId.get(conversationId);
  if (session?.ringTimer) clearTimeout(session.ringTimer);
  sessionsByConversationId.delete(conversationId);
};

export const scheduleRingTimeout = (session: CallSession, onTimeout: () => void): void => {
  session.ringTimer = setTimeout(onTimeout, CALL_RING_TIMEOUT_MS);
};

export const clearRingTimer = (session: CallSession): void => {
  if (session.ringTimer) {
    clearTimeout(session.ringTimer);
    session.ringTimer = undefined;
  }
};

export interface CallSnapshot {
  callType: CallType;
  participantCount: number;
  participantUserIds: string[];
}

export const getSnapshot = (conversationId: string): CallSnapshot | null => {
  const session = sessionsByConversationId.get(conversationId);
  if (!session) return null;

  return {
    callType: session.callType,
    participantCount: session.participants.size,
    participantUserIds: Array.from(session.participants.keys()),
  };
};
