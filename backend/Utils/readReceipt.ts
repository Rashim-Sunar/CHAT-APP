import { Types } from 'mongoose';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';

export type SeenReceiptPayload = {
  conversationId: string;
  readerId: string;
  seenAt: string;
  recipientId: string;
};

type MessageLike = {
  senderId: Types.ObjectId | string;
  createdAt: Date | string;
  deletedForEveryone?: boolean;
  deletedFor?: Array<Types.ObjectId | string>;
};

const isVisibleToReader = (message: MessageLike, readerId: string): boolean => {
  if (message.deletedForEveryone) return false;

  const deletedFor = Array.isArray(message.deletedFor)
    ? message.deletedFor.map((value) => String(value))
    : [];

  return !deletedFor.includes(String(readerId));
};

const getConversationParticipant = (conversation: ConversationDocument, readerId: string): string | null => {
  const participant = conversation.participants
    .map((value) => String(value))
    .find((participantId) => participantId !== String(readerId));

  return participant || null;
};

/**
 * Persist the latest read timestamp for a 1:1 conversation and return the
 * socket payload needed to notify the other participant.
 *
 * This keeps read-state logic in one place so the HTTP history fetch and the
 * realtime socket path stay consistent.
 */
export const recordConversationSeen = async (
  conversationId: string,
  readerId: string
): Promise<SeenReceiptPayload | null> => {
  const conversation = (await Conversation.findById(conversationId).populate('messages')) as
    | ConversationDocument
    | null;

  if (!conversation) return null;

  const recipientId = getConversationParticipant(conversation, readerId);
  if (!recipientId) return null;

  const currentReadBy = Array.isArray(
    (conversation as unknown as { readBy?: Array<{ userId: Types.ObjectId; seenAt: Date }> }).readBy
  )
    ? ((conversation as unknown as { readBy?: Array<{ userId: Types.ObjectId; seenAt: Date }> }).readBy || [])
    : [];

  const previousSeenAt =
    currentReadBy.find((entry) => String(entry.userId) === String(readerId))?.seenAt || new Date(0);

  const messages = (conversation.messages as unknown as MessageLike[]) || [];
  const latestUnreadIncomingMessage = [...messages]
    .filter((message) => String(message.senderId) !== String(readerId))
    .filter((message) => isVisibleToReader(message, readerId))
    .sort((firstMessage, secondMessage) =>
      new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime()
    )
    .at(-1);

  if (!latestUnreadIncomingMessage) return null;

  if (new Date(latestUnreadIncomingMessage.createdAt).getTime() <= new Date(previousSeenAt).getTime()) {
    return null;
  }

  const seenAt = new Date();
  const nextReadBy = currentReadBy.filter((entry) => String(entry.userId) !== String(readerId));
  nextReadBy.push({
    userId: new Types.ObjectId(readerId),
    seenAt,
  });

  (conversation as unknown as { readBy: Array<{ userId: Types.ObjectId; seenAt: Date }> }).readBy = nextReadBy;
  await conversation.save();

  return {
    conversationId: String(conversation._id),
    readerId: String(readerId),
    seenAt: seenAt.toISOString(),
    recipientId: String(recipientId),
  };
};
