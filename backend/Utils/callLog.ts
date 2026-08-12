// ----------------------------------------
// @file   Utils/callLog.ts
// @desc   Writes the durable record of a finished call as a plain Message
//         doc (messageType: 'call_log') — a system message, not user
//         content, so it bypasses sendConversationMessage's E2EE-payload
//         validation entirely and is built/saved directly here.
// ----------------------------------------

import Message, { MessageDocument } from '../models/messageModel.js';
import type { ConversationDocument } from '../models/conversationModel.js';
import type { CallStatus, CallType } from '../models/messageModel.js';
import { emitToUserDevices } from '../socket/socket.js';
import { buildRealtimePayload } from '../controllers/messageController.js';

export const createCallLogMessage = async (
  conversation: ConversationDocument,
  initiatorUserId: string,
  details: { callType: CallType; callStatus: CallStatus; callDurationSec?: number }
): Promise<void> => {
  const isDirect = conversation.type === 'direct';
  const participantIds = conversation.participants.map((participantId) => String(participantId));
  const otherParticipantId = isDirect
    ? participantIds.find((participantId) => participantId !== initiatorUserId)
    : undefined;

  const callLogMessage = new Message({
    senderId: initiatorUserId,
    receiverId: otherParticipantId,
    conversationId: conversation._id,
    messageType: 'call_log',
    callType: details.callType,
    callStatus: details.callStatus,
    callDurationSec: details.callDurationSec,
  });

  conversation.messages.push(callLogMessage._id);
  await Promise.all([callLogMessage.save(), conversation.save()]);

  const messageWithTimestamps = callLogMessage as unknown as MessageDocument & {
    createdAt: Date;
    updatedAt: Date;
  };
  const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

  conversation.participants.forEach((participantId) => {
    emitToUserDevices(String(participantId), 'newMessage', realtimeMessagePayload);
  });
};
