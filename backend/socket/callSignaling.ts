// ----------------------------------------
// @file   socket/callSignaling.ts
// @desc   WebRTC call signaling — invites, ringing, join/leave, and relaying
//         SDP offers/answers + ICE candidates between the exact devices that
//         are actually in a call. The server never touches media, only
//         these small signaling messages (mirrors the E2EE text-message
//         model: the server relays opaque envelopes, never content).
// ----------------------------------------

import type { Server, Socket } from 'socket.io';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';
import type { CallType } from '../models/messageModel.js';
import { emitToUserDevices } from './socket.js';
import { createCallLogMessage } from '../Utils/callLog.js';
import {
  addParticipant,
  clearRingTimer,
  createSession,
  endSession,
  getSession,
  removeParticipant,
  removeParticipantBySocketId,
  scheduleRingTimeout,
} from '../Utils/callSession.js';

type PopulatedParticipant = { _id: unknown; userName: string; profilePic?: string };
type PopulatedConversation = Omit<ConversationDocument, 'participants'> & {
  participants: PopulatedParticipant[];
};

const loadConversationForCall = async (conversationId: string): Promise<PopulatedConversation | null> => {
  if (!conversationId) return null;
  return (await Conversation.findById(conversationId).populate(
    'participants',
    'userName profilePic'
  )) as unknown as PopulatedConversation | null;
};

const isParticipant = (conversation: PopulatedConversation, userId: string): boolean =>
  conversation.participants.some((participant) => String(participant._id) === userId);

export const registerCallSignalingHandlers = (io: Server, socket: Socket, userId: string): void => {
  if (!userId) return;

  socket.on('call:invite', async ({ conversationId, callType }: { conversationId: string; callType: CallType }) => {
    try {
      const conversation = await loadConversationForCall(conversationId);
      if (!conversation || conversation.type !== 'direct' || !isParticipant(conversation, userId)) return;
      if (getSession(conversationId)) return; // a call is already in flight here

      const calleeId = conversation.participants
        .map((participant) => String(participant._id))
        .find((participantId) => participantId !== userId);
      if (!calleeId) return;

      const caller = conversation.participants.find((participant) => String(participant._id) === userId);

      const session = createSession(conversationId, 'direct', callType);
      addParticipant(session, userId, socket.id);

      emitToUserDevices(calleeId, 'call:incoming', {
        conversationId,
        callType,
        fromUserId: userId,
        fromUserName: caller?.userName || 'Unknown',
        fromUserAvatar: caller?.profilePic,
      });

      scheduleRingTimeout(session, () => {
        void (async () => {
          const current = getSession(conversationId);
          if (!current) return;
          emitToUserDevices(calleeId, 'call:ended', { conversationId, reason: 'missed' });
          emitToUserDevices(userId, 'call:ended', { conversationId, reason: 'missed' });
          endSession(conversationId);
          await createCallLogMessage(conversation as unknown as ConversationDocument, userId, {
            callType,
            callStatus: 'missed',
          });
        })();
      });
    } catch (error: unknown) {
      console.log('Error in call:invite handler', error instanceof Error ? error.message : String(error));
    }
  });

  socket.on('call:start', async ({ conversationId, callType }: { conversationId: string; callType: CallType }) => {
    try {
      const conversation = await loadConversationForCall(conversationId);
      if (!conversation || conversation.type !== 'group' || !isParticipant(conversation, userId)) return;

      let session = getSession(conversationId);
      if (!session) {
        session = createSession(conversationId, 'group', callType);
        conversation.participants
          .map((participant) => String(participant._id))
          .filter((participantId) => participantId !== userId)
          .forEach((participantId) => {
            emitToUserDevices(participantId, 'call:started', { conversationId, callType, startedByUserId: userId });
          });
      }

      const result = addParticipant(session, userId, socket.id);
      if (!result.ok) {
        emitToUserDevices(userId, 'call:join-rejected', { conversationId, reason: result.reason });
        return;
      }

      emitToUserDevices(userId, 'call:roster-snapshot', {
        conversationId,
        callType: session.callType,
        participantUserIds: Array.from(session.participants.keys()).filter((id) => id !== userId),
      });
    } catch (error: unknown) {
      console.log('Error in call:start handler', error instanceof Error ? error.message : String(error));
    }
  });

  socket.on('call:join', async ({ conversationId, callType }: { conversationId: string; callType: CallType }) => {
    try {
      const conversation = await loadConversationForCall(conversationId);
      if (!conversation || !isParticipant(conversation, userId)) return;

      let session = getSession(conversationId);
      const isNewGroupCall = !session && conversation.type === 'group';
      if (!session) {
        if (conversation.type !== 'group') return; // direct calls must originate from call:invite
        session = createSession(conversationId, 'group', callType);
      }

      const existingParticipantIds = Array.from(session.participants.keys()).filter((id) => id !== userId);
      const result = addParticipant(session, userId, socket.id);
      if (!result.ok) {
        emitToUserDevices(userId, 'call:join-rejected', { conversationId, reason: result.reason });
        return;
      }

      clearRingTimer(session);
      emitToUserDevices(userId, 'call:invite-resolved', { conversationId });

      // Broadcast to every conversation member, not just current call
      // participants — non-participant group members need this too, to
      // keep a passive "ongoing call, tap to join" banner's headcount live
      // without joining the mesh themselves.
      conversation.participants
        .map((participant) => String(participant._id))
        .filter((participantId) => participantId !== userId)
        .forEach((participantId) => {
          emitToUserDevices(participantId, 'call:participant-joined', { conversationId, userId });
        });

      emitToUserDevices(userId, 'call:roster-snapshot', {
        conversationId,
        callType: session.callType,
        participantUserIds: existingParticipantIds,
      });

      if (isNewGroupCall) {
        conversation.participants
          .map((participant) => String(participant._id))
          .filter((participantId) => participantId !== userId)
          .forEach((participantId) => {
            emitToUserDevices(participantId, 'call:started', { conversationId, callType, startedByUserId: userId });
          });
      }
    } catch (error: unknown) {
      console.log('Error in call:join handler', error instanceof Error ? error.message : String(error));
    }
  });

  socket.on('call:decline', async ({ conversationId }: { conversationId: string }) => {
    try {
      const conversation = await loadConversationForCall(conversationId);
      const session = getSession(conversationId);
      if (!conversation || !session) return;

      const callerId = Array.from(session.participants.keys())[0];
      endSession(conversationId);

      emitToUserDevices(userId, 'call:invite-resolved', { conversationId });
      if (callerId) emitToUserDevices(callerId, 'call:declined', { conversationId, byUserId: userId });

      await createCallLogMessage(conversation as unknown as ConversationDocument, callerId || userId, {
        callType: session.callType,
        callStatus: 'declined',
      });
    } catch (error: unknown) {
      console.log('Error in call:decline handler', error instanceof Error ? error.message : String(error));
    }
  });

  const handleLeave = async (conversationId: string) => {
    const session = getSession(conversationId);
    if (!session) return;

    const wasParticipant = session.participants.has(userId);
    removeParticipant(session, userId);

    if (!wasParticipant) return;

    // A direct call only ever has two participants, so once it's down to
    // the last one, the call is over for them too — not just "someone left"
    // while the call carries on, which is only meaningful for groups.
    const isDirectCallOver = session.conversationType === 'direct' && session.participants.size > 0;

    if (session.participants.size === 0 || isDirectCallOver) {
      const conversation = await loadConversationForCall(conversationId);
      const callStatus = session.connectedAt ? 'ended' : 'missed';
      const callDurationSec = session.connectedAt
        ? Math.round((Date.now() - session.connectedAt) / 1000)
        : undefined;
      const remainingUserId = isDirectCallOver ? Array.from(session.participants.keys())[0] : undefined;

      emitToUserDevices(userId, 'call:ended', { conversationId, reason: callStatus });
      if (remainingUserId) {
        emitToUserDevices(remainingUserId, 'call:ended', { conversationId, reason: callStatus });
      }

      endSession(conversationId);
      if (conversation) {
        await createCallLogMessage(conversation as unknown as ConversationDocument, userId, {
          callType: session.callType,
          callStatus,
          callDurationSec,
        });
      }
    } else {
      // See call:join — notify every conversation member, not just current
      // call participants, so a passive group banner stays live.
      const conversation = await loadConversationForCall(conversationId);
      const notifyIds = conversation
        ? conversation.participants.map((participant) => String(participant._id))
        : Array.from(session.participants.keys());
      notifyIds
        .filter((participantId) => participantId !== userId)
        .forEach((participantId) => {
          emitToUserDevices(participantId, 'call:participant-left', { conversationId, userId });
        });
    }
  };

  socket.on('call:leave', ({ conversationId }: { conversationId: string }) => {
    void handleLeave(conversationId).catch((error: unknown) =>
      console.log('Error in call:leave handler', error instanceof Error ? error.message : String(error))
    );
  });

  const relayToParticipant = (
    conversationId: string,
    fromUserId: string,
    toUserId: string,
    eventName: string,
    payload: Record<string, unknown>
  ) => {
    const session = getSession(conversationId);
    if (!session) return;
    const fromEntry = session.participants.get(fromUserId);
    const toEntry = session.participants.get(toUserId);
    if (!fromEntry || !toEntry) return; // both sides must be genuine current call participants

    io.to(toEntry.socketId).emit(eventName, { conversationId, fromUserId, ...payload });
  };

  socket.on(
    'call:offer',
    ({ conversationId, toUserId, sdp }: { conversationId: string; toUserId: string; sdp: unknown }) => {
      relayToParticipant(conversationId, userId, toUserId, 'call:offer', { sdp });
    }
  );

  socket.on(
    'call:answer',
    ({ conversationId, toUserId, sdp }: { conversationId: string; toUserId: string; sdp: unknown }) => {
      relayToParticipant(conversationId, userId, toUserId, 'call:answer', { sdp });
    }
  );

  socket.on(
    'call:ice-candidate',
    ({ conversationId, toUserId, candidate }: { conversationId: string; toUserId: string; candidate: unknown }) => {
      relayToParticipant(conversationId, userId, toUserId, 'call:ice-candidate', { candidate });
    }
  );

  socket.on(
    'call:media-state',
    ({
      conversationId,
      audioEnabled,
      videoEnabled,
    }: {
      conversationId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      const session = getSession(conversationId);
      if (!session || !session.participants.has(userId)) return;

      session.participants.forEach((participant) => {
        if (participant.userId === userId) return;
        io.to(participant.socketId).emit('call:media-state', {
          conversationId,
          fromUserId: userId,
          audioEnabled,
          videoEnabled,
        });
      });
    }
  );
};

// Called from socket.ts's disconnect handler so a closed tab doesn't leave a
// phantom participant occupying a call slot forever.
export const handleSocketDisconnect = (socketId: string): void => {
  const removed = removeParticipantBySocketId(socketId);
  if (!removed) return;

  const { session, userId } = removed;
  const conversationId = session.conversationId;

  // See handleLeave — a direct call ends for the remaining side too once
  // it's down to just them, not merely "a participant left."
  const isDirectCallOver = session.conversationType === 'direct' && session.participants.size > 0;

  if (session.participants.size === 0 || isDirectCallOver) {
    const callStatus = session.connectedAt ? 'ended' : 'missed';
    const callDurationSec = session.connectedAt
      ? Math.round((Date.now() - session.connectedAt) / 1000)
      : undefined;
    const remainingUserId = isDirectCallOver ? Array.from(session.participants.keys())[0] : undefined;

    if (remainingUserId) {
      emitToUserDevices(remainingUserId, 'call:ended', { conversationId, reason: callStatus });
    }

    endSession(conversationId);

    void loadConversationForCall(conversationId).then((conversation) => {
      if (!conversation) return;
      return createCallLogMessage(conversation as unknown as ConversationDocument, userId, {
        callType: session.callType,
        callStatus,
        callDurationSec,
      });
    });
  } else {
    void loadConversationForCall(conversationId).then((conversation) => {
      const notifyIds = conversation
        ? conversation.participants.map((participant) => String(participant._id))
        : Array.from(session.participants.keys());
      notifyIds
        .filter((participantId) => participantId !== userId)
        .forEach((participantId) => {
          emitToUserDevices(participantId, 'call:participant-left', { conversationId, userId });
        });
    });
  }
};
