// ----------------------------------------
// @file   messageController.ts
// @desc   Handles messaging functionality (send & retrieve messages)
// ----------------------------------------

import type { Response } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';
import Message, { MessageDocument, CallStatus, CallType } from '../models/messageModel.js';
import { emitToUserDevices } from '../socket/socket.js';
import { recordConversationSeen } from '../Utils/readReceipt.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type {
  CreateFileDeliveryUrlDto,
  CreateUploadSignatureDto,
  DeleteMessageDto,
  EditMessageDto,
  ReactToMessageDto,
  SendMessageDto,
} from '../types/dtos/message.js';
import { getCloudinary } from '../Utils/cloudinary.js';
import {
  sanitizeFileName,
  validateFilePayload,
  resolveMessageTypeFromMime,
  resolveCloudinaryResourceType,
  getMaxUploadSizeBytes,
} from '../Utils/fileValidation.js';

// Derive a file format token used by Cloudinary signed delivery helpers.
// Raw assets often rely on extension-based format hints during download URL generation.
const getFileFormat = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Cloudinary's private_download_url requires a format hint for raw assets.
  // If a file has no extension, fall back to a generic binary payload.
  return extension || 'bin';
};

type RealtimeMessageReaction = {
  userId: string;
  emoji: string;
};

export type RealtimeMessagePayload = {
  _id: string;
  senderId: string;
  // Populated for direct messages only; null for group messages, which have
  // no single recipient — routing/authorization uses conversation
  // participants instead (see messageController.ts).
  receiverId: string | null;
  conversationId: string;
  messageType: 'text' | 'image' | 'video' | 'file' | 'call_log';
  text: string;
  message: string;
  encryptedMessage: string | null;
  encryptedAESKey: string | null;
  encryptedAESKeys: { userId: string; wrappedKey: string }[];
  iv: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  publicId: string | null;
  edited: boolean;
  editedAt: Date | null;
  deletedForEveryone: boolean;
  deletedFor: string[];
  reactions: RealtimeMessageReaction[];
  replyTo: string | null;
  forwarded: boolean;
  callType: CallType | null;
  callStatus: CallStatus | null;
  callDurationSec: number | null;
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Enforce Cloudinary-owned asset URLs only. This prevents clients from sending
// arbitrary third-party links as media attachments.
export const isCloudinaryUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('res.cloudinary.com');
  } catch {
    return false;
  }
};

// Resource path fragments expected for each media type in Cloudinary delivery URLs.
const cloudinaryPathByType: Record<'image' | 'video' | 'file', string> = {
  image: '/image/upload/',
  video: '/video/upload/',
  file: '/raw/upload/',
};

// Ensures the Cloudinary URL path aligns with the declared message type.
// Example: a "video" message must resolve to /video/upload/.
export const isCloudinaryPathValidForType = (
  url: string,
  messageType: 'image' | 'video' | 'file'
): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes(cloudinaryPathByType[messageType]);
  } catch {
    return false;
  }
};

// Produces one canonical message shape for both REST responses and socket events.
//
// This is the normalization boundary for the entire chat system. Any payload
// leaving the backend should already contain the exact fields the frontend
// needs to render the message without guessing which legacy field name to use.
// Keeping this logic centralized also prevents REST responses and socket
// events from drifting apart over time.
export const buildRealtimePayload = (
  messageDoc: MessageDocument & { createdAt: Date; updatedAt: Date },
  conversationId: string
): RealtimeMessagePayload => {
  // Backward compatibility: older documents used `message` instead of `text`
  // and may not have messageType set. We read all historical shapes here so
  // previously stored conversations remain visible after schema evolution.
  const legacyTextFromDoc =
    typeof (messageDoc as unknown as { message?: unknown }).message === 'string'
      ? ((messageDoc as unknown as { message?: string }).message as string)
      : '';
  const legacyTextFromRaw =
    typeof (messageDoc as unknown as { _doc?: { message?: unknown } })._doc?.message === 'string'
      ? ((messageDoc as unknown as { _doc?: { message?: string } })._doc?.message as string)
      : '';
  const legacyTextFromGetter =
    typeof (messageDoc as unknown as { get?: (path: string) => unknown }).get === 'function'
      ? ((messageDoc as unknown as { get: (path: string) => unknown }).get('message') as string) || ''
      : '';
  const legacyText = legacyTextFromDoc || legacyTextFromRaw || legacyTextFromGetter;
  const normalizedText = messageDoc.text || legacyText || '';
  const normalizedMessageType = messageDoc.messageType || 'text';
  const encryptedMessage =
    typeof (messageDoc as unknown as { encryptedMessage?: unknown }).encryptedMessage === 'string'
      ? ((messageDoc as unknown as { encryptedMessage?: string }).encryptedMessage as string)
      : null;
  const encryptedAESKey =
    typeof (messageDoc as unknown as { encryptedAESKey?: unknown }).encryptedAESKey === 'string'
      ? ((messageDoc as unknown as { encryptedAESKey?: string }).encryptedAESKey as string)
      : null;
  const iv =
    typeof (messageDoc as unknown as { iv?: unknown }).iv === 'string'
      ? ((messageDoc as unknown as { iv?: string }).iv as string)
      : null;
  const deletedForEveryone = Boolean(
    (messageDoc as unknown as { deletedForEveryone?: boolean }).deletedForEveryone
  );
  const deletedFor = Array.isArray((messageDoc as unknown as { deletedFor?: unknown[] }).deletedFor)
    ? ((messageDoc as unknown as { deletedFor?: unknown[] }).deletedFor || []).map((userId) =>
        String(userId)
      )
    : [];
  const edited = Boolean((messageDoc as unknown as { edited?: boolean }).edited);
  const editedAt =
    (messageDoc as unknown as { editedAt?: Date | null }).editedAt || null;
  const visibleText = deletedForEveryone ? MESSAGE_DELETED_TEXT : normalizedText;
  const rawReactions = Array.isArray(
    (messageDoc as unknown as { reactions?: Array<{ userId: unknown; emoji: unknown }> }).reactions
  )
    ? ((messageDoc as unknown as { reactions?: Array<{ userId: unknown; emoji: unknown }> })
        .reactions as Array<{ userId: unknown; emoji: unknown }>)
    : [];
  const reactions: RealtimeMessageReaction[] = rawReactions
    .filter((reaction) => typeof reaction?.emoji === 'string')
    .map((reaction) => ({ userId: String(reaction.userId), emoji: String(reaction.emoji) }));
  const replyTo = (messageDoc as unknown as { replyTo?: unknown }).replyTo
    ? String((messageDoc as unknown as { replyTo?: unknown }).replyTo)
    : null;
  const forwarded = Boolean((messageDoc as unknown as { forwarded?: boolean }).forwarded);
  const rawEncryptedAESKeys = Array.isArray(
    (messageDoc as unknown as { encryptedAESKeys?: Array<{ userId: unknown; wrappedKey: unknown }> })
      .encryptedAESKeys
  )
    ? ((messageDoc as unknown as { encryptedAESKeys?: Array<{ userId: unknown; wrappedKey: unknown }> })
        .encryptedAESKeys as Array<{ userId: unknown; wrappedKey: unknown }>)
    : [];
  const encryptedAESKeys = rawEncryptedAESKeys
    .filter((entry) => typeof entry?.wrappedKey === 'string')
    .map((entry) => ({ userId: String(entry.userId), wrappedKey: String(entry.wrappedKey) }));

  return {
    _id: String(messageDoc._id),
    senderId: String(messageDoc.senderId),
    receiverId: messageDoc.receiverId ? String(messageDoc.receiverId) : null,
    conversationId,
    messageType: normalizedMessageType,
    text: visibleText,
    // Backward-compatible field for existing clients still reading `message`.
    message: visibleText,
    encryptedMessage,
    encryptedAESKey,
    encryptedAESKeys,
    iv,
    fileUrl: messageDoc.fileUrl || null,
    fileName: messageDoc.fileName || null,
    fileSize: typeof messageDoc.fileSize === 'number' ? messageDoc.fileSize : null,
    mimeType: messageDoc.mimeType || null,
    publicId: typeof (messageDoc as unknown as { publicId?: unknown }).publicId === 'string'
      ? ((messageDoc as unknown as { publicId?: string }).publicId as string)
      : null,
    edited,
    editedAt,
    deletedForEveryone,
    deletedFor,
    reactions,
    replyTo,
    forwarded,
    callType: messageDoc.callType || null,
    callStatus: messageDoc.callStatus || null,
    callDurationSec: typeof messageDoc.callDurationSec === 'number' ? messageDoc.callDurationSec : null,
    pinned: Boolean(messageDoc.pinned),
    pinnedAt: messageDoc.pinnedAt || null,
    pinnedBy: messageDoc.pinnedBy ? String(messageDoc.pinnedBy) : null,
    createdAt: messageDoc.createdAt,
    updatedAt: messageDoc.updatedAt,
  };
};

// Validates and normalizes payloads for text/media messages before persistence.
//
// This is intentionally strict. The server treats the client as untrusted and
// rejects malformed media payloads before they ever reach MongoDB or Socket.IO.
// That keeps message history consistent and prevents invalid media records from
// leaking into the chat timeline.
const validateSendPayload = (
  body: SendMessageDto
): { valid: true; payload: Required<Pick<SendMessageDto, 'messageType'>> & SendMessageDto } | { valid: false; reason: string } => {
  const messageType = body.messageType || 'text';
  const rawText = (body.text ?? body.message ?? '').trim();
  const hasEncryptedPayload = Boolean(body.encryptedMessage || body.encryptedAESKey || body.iv);

  if (messageType === 'text') {
    if (hasEncryptedPayload) {
      if (!body.encryptedMessage || !body.encryptedAESKey || !body.iv) {
        return { valid: false, reason: 'Encrypted payload is incomplete' };
      }

      return {
        valid: true,
        payload: {
          ...body,
          messageType,
          text: '',
          encryptedMessage: body.encryptedMessage,
          encryptedAESKey: body.encryptedAESKey,
          iv: body.iv,
        },
      };
    }

    if (!rawText) {
      return { valid: false, reason: 'Text message cannot be empty' };
    }

    return {
      valid: true,
      payload: {
        ...body,
        messageType,
        text: rawText,
      },
    };
  }

  if (!body.fileUrl || !body.fileName || !body.mimeType || !body.fileSize) {
    return { valid: false, reason: 'Media messages must include file metadata' };
  }

  const fileValidation = validateFilePayload(body.fileName, body.mimeType, Number(body.fileSize));
  if (!fileValidation.valid) {
    return { valid: false, reason: fileValidation.reason };
  }

  const resolvedType = resolveMessageTypeFromMime(body.mimeType);
  if (!resolvedType || resolvedType !== messageType) {
    return { valid: false, reason: 'messageType does not match mimeType' };
  }

  if (!isCloudinaryUrl(body.fileUrl)) {
    return { valid: false, reason: 'Invalid file host' };
  }

  if (!isCloudinaryPathValidForType(body.fileUrl, messageType)) {
    return { valid: false, reason: 'File URL resource type mismatch' };
  }

  return {
    valid: true,
    payload: {
      ...body,
      messageType,
      text: rawText,
    },
  };
};

// Canonical deleted placeholder used in normalized payloads for all clients.
export const MESSAGE_DELETED_TEXT = 'This message was deleted';

// Per-user visibility guard for soft-deleted messages.
// "Deleted for everyone" remains visible as a placeholder, while
// "deleted for me" removes the message from that specific user's timeline.
export const isMessageDeletedForUser = (messageDoc: MessageDocument, userId: string): boolean => {
  if (!userId) return false;

  const deletedForEveryone = Boolean(
    (messageDoc as unknown as { deletedForEveryone?: boolean }).deletedForEveryone
  );
  if (deletedForEveryone) return false;

  const deletedFor = Array.isArray((messageDoc as unknown as { deletedFor?: unknown[] }).deletedFor)
    ? ((messageDoc as unknown as { deletedFor?: unknown[] }).deletedFor || []).map((value) =>
        String(value)
      )
    : [];

  return deletedFor.includes(String(userId));
};

// Resolve parent conversation once for edit/delete flows so socket events can
// include a stable conversationId in the realtime payload.
export const getMessageConversation = async (messageId: string): Promise<ConversationDocument | null> => {
  return (await Conversation.findOne({ messages: messageId })) as ConversationDocument | null;
};

// Fan out message mutation events to every current conversation participant
// (not just sender+receiver — required for groups, and as a side effect also
// fixes 1:1 chats never reaching a sender's second open tab/device, since
// emitToUserDevices — unlike the old getReceiverSocketId path — reaches every
// active socket for a user, not just the first one).
const emitMessageUpdateToParticipants = (
  eventName: 'message:edit' | 'message:delete' | 'message:reaction' | 'message:pin',
  conversation: ConversationDocument,
  payload: RealtimeMessagePayload
): void => {
  const participantIds = new Set(conversation.participants.map((participantId) => String(participantId)));

  participantIds.forEach((participantId) => {
    emitToUserDevices(participantId, eventName, payload);
  });
};

// Best-effort attachment cleanup after delete-for-everyone to avoid orphaned
// Cloudinary resources. This intentionally no-ops when no publicId exists.
const deleteCloudinaryAsset = async (message: MessageDocument): Promise<void> => {
  const publicId = typeof message.publicId === 'string' ? message.publicId.trim() : '';
  if (!publicId) return;

  const cloudinary = getCloudinary();
  const resourceType =
    message.messageType === 'image' || message.messageType === 'video'
      ? message.messageType
      : 'raw';

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
};

/**
 * Creates a short-lived, signed Cloudinary upload contract.
 *
 * Security model:
 * - API secret stays server-side only.
 * - Client uploads directly to Cloudinary using returned signature fields.
 * - Metadata is validated before signing to avoid issuing signatures for invalid files.
 */
export const createUploadSignature = async (
  req: AuthenticatedRequest<unknown, unknown, CreateUploadSignatureDto>,
  res: Response
): Promise<void> => {
  try {
    const { fileName, mimeType, fileSize } = req.body;

    const fileValidation = validateFilePayload(fileName, mimeType, Number(fileSize));
    if (!fileValidation.valid) {
      res.status(400).json({ error: fileValidation.reason });
      return;
    }

    const resourceType = resolveCloudinaryResourceType(mimeType);
    if (!resourceType) {
      res.status(400).json({ error: 'Unsupported file type' });
      return;
    }

    const cloudinary = getCloudinary();
    const timestamp = Math.floor(Date.now() / 1000);
    const safeName = sanitizeFileName(fileName);
    const senderId = String(req.user || 'unknown');
    const publicId = `chat_uploads/${senderId}/${timestamp}_${crypto.randomUUID()}_${safeName}`;

    // The upload signature only covers immutable fields that the client should
    // be allowed to submit. This prevents the browser from mutating the upload
    // contract after the signature has been issued.
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        public_id: publicId,
        access_mode: 'public',
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      publicId,
      resourceType,
      accessMode: 'public',
      maxFileSizeBytes: getMaxUploadSizeBytes(),
    });
  } catch (error: unknown) {
    console.log(
      'Error in createUploadSignature:',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Generates a signed delivery URL for assets that are not publicly reachable.
 *
 * Why this exists:
 * - Some raw files are uploaded with delivery restrictions or account-level
 *   access controls, which makes the plain `secure_url` fail with 401/403.
 * - A signed delivery URL lets the browser access the asset without exposing
 *   the API secret or switching the asset to unsigned delivery.
 */
export const createFileDeliveryUrl = async (
  req: AuthenticatedRequest<unknown, unknown, CreateFileDeliveryUrlDto>,
  res: Response
): Promise<void> => {
  try {
    const { publicId, fileName, messageType, attachment = false } = req.body;

    if (!publicId || !fileName) {
      res.status(400).json({ error: 'publicId and fileName are required' });
      return;
    }

    const cloudinary = getCloudinary();
    const format = getFileFormat(fileName);

    // Raw files are the common case for PDFs and office documents, but this
    // helper also supports other restricted assets when the upload or delivery
    // policy requires a signed URL instead of a public CDN path.
    const resourceType = messageType === 'image' || messageType === 'video' ? messageType : 'raw';

    const signedUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: 'upload',
      attachment,
    });

    res.status(200).json({ signedUrl });
  } catch (error: unknown) {
    console.log(
      'Error in createFileDeliveryUrl:',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Failed to generate signed delivery URL' });
  }
};

/**
 * @desc    Sends a message between users and updates conversation
 * @route   POST /api/messages/:id
 * @access  Private
 * @param   req.params.id - receiver user ID
 * @param   req.body - text payload or media payload with metadata
 * @returns JSON response with canonical realtime-compatible message payload
 */
export const sendMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, SendMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user;
    const payloadValidation = validateSendPayload(req.body);

    if (!payloadValidation.valid) {
      res.status(400).json({ error: payloadValidation.reason });
      return;
    }

    const { payload } = payloadValidation;

    // Find existing conversation between sender and receiver
    let conversation = (await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    })) as ConversationDocument | null;

    // Create new conversation if not exists
    if (!conversation) {
      conversation = (await Conversation.create({
        participants: [senderId, receiverId],
      })) as ConversationDocument;
    }

    // A reply must reference a message that's already part of *this* same
    // conversation — otherwise silently drop it rather than trusting a
    // cross-conversation ID the client could have fabricated.
    let validatedReplyTo: string | undefined;
    if (payload.replyTo) {
      const referencedMessageId = String(payload.replyTo);
      const belongsToConversation = conversation.messages.some(
        (existingMessageId) => String(existingMessageId) === referencedMessageId
      );

      if (belongsToConversation) {
        validatedReplyTo = referencedMessageId;
      }
    }

    // Persist exactly one message document shape for all message types.
    // For E2EE text, encryptedMessage/encryptedAESKey/iv are stored as-is.
    // The server is intentionally blind and never decrypts or rewrites ciphertext.
    const newMessage = new Message({
      senderId,
      receiverId,
      messageType: payload.messageType,
      text: payload.text,
      encryptedMessage: payload.encryptedMessage,
      encryptedAESKey: payload.encryptedAESKey,
      iv: payload.iv,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      publicId: payload.publicId,
      replyTo: validatedReplyTo,
      forwarded: Boolean(payload.forwarded),
    });

    // Link message to conversation
    conversation.messages.push(newMessage._id);

    // Save both message and conversation concurrently
    await Promise.all([newMessage.save(), conversation.save()]);

    const messageWithTimestamps = newMessage as unknown as MessageDocument & {
      createdAt: Date;
      updatedAt: Date;
    };

    const realtimeMessagePayload = buildRealtimePayload(
      messageWithTimestamps,
      String(conversation._id)
    );

    // Emit to every device of every participant. The sender's *current* tab
    // already has the message via the HTTP response, but other open
    // tabs/devices for the sender only ever learn about it through this
    // socket event — the frontend already dedupes by message _id, so the
    // redundant emit to the sender's current tab is a harmless no-op.
    conversation.participants.forEach((participantId) => {
      emitToUserDevices(String(participantId), 'newMessage', realtimeMessagePayload);
    });

    res.status(201).json({ newMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Some error occured in message controller',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).send({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Retrieves all messages between authenticated user and another user
 * @route   GET /api/messages/:id
 * @access  Private
 * @param   req.params.id - user to chat with
 * @returns Array of canonical message payloads
 */
export const getMessage = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user;

    // Fetch conversation and populate message documents
    const conversation = (await Conversation.findOne({
      participants: { $all: [senderId, userToChatId] },
    }).populate('messages')) as ConversationDocument | null;

    // Return empty array if no conversation exists
    if (!conversation) {
      res.status(200).json([]);
      return;
    }

    const receipt = await recordConversationSeen(String(conversation._id), String(senderId));
    if (receipt) {
      receipt.recipientIds.forEach((recipientId) => {
        emitToUserDevices(recipientId, 'conversation:seen', receipt);
      });
    }

    const messages = (conversation.messages as unknown as MessageDocument[])
      .filter((messageDoc) => !isMessageDeletedForUser(messageDoc, String(senderId)))
      .map((messageDoc) => {
        const messageWithTimestamps = messageDoc as MessageDocument & {
          createdAt: Date;
          updatedAt: Date;
        };

        return buildRealtimePayload(messageWithTimestamps, String(conversation._id));
      });

    res.status(200).json(messages);
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error in getMessages controller: ',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Updates the text content of a message owned by the authenticated user.
 * The mutation is rejected for empty content and for messages that were
 * already soft-deleted.
 */
export const editMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, EditMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const { id: messageId } = req.params;
    const senderId = String(req.user);
    const content = req.body.content?.trim();
    const hasEncryptedPayload = Boolean(
      req.body.encryptedMessage || req.body.encryptedAESKey || req.body.iv
    );

    if (hasEncryptedPayload) {
      if (!req.body.encryptedMessage || !req.body.encryptedAESKey || !req.body.iv) {
        res.status(400).json({ error: 'Encrypted edit payload is incomplete' });
        return;
      }
    } else if (!content) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    const message = (await Message.findById(messageId)) as MessageDocument | null;
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (String(message.senderId) !== senderId) {
      res.status(403).json({ error: 'You can only edit your own messages' });
      return;
    }

    if (message.messageType !== 'text') {
      res.status(400).json({ error: 'Only text messages can be edited' });
      return;
    }

    if (message.deletedForEveryone || isMessageDeletedForUser(message, senderId)) {
      res.status(400).json({ error: 'Deleted messages cannot be edited' });
      return;
    }

    const conversation = await getMessageConversation(messageId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (hasEncryptedPayload) {
      // Zero-knowledge behavior: store opaque ciphertext fields only.
      message.text = '';
      message.encryptedMessage = req.body.encryptedMessage;
      message.encryptedAESKey = req.body.encryptedAESKey;
      message.iv = req.body.iv;
    } else {
      message.text = content;
      message.encryptedMessage = undefined;
      message.encryptedAESKey = undefined;
      message.iv = undefined;
    }
    message.edited = true;
    message.editedAt = new Date();

    await message.save();

    const messageWithTimestamps = message as MessageDocument & {
      createdAt: Date;
      updatedAt: Date;
    };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    emitMessageUpdateToParticipants('message:edit', conversation, realtimeMessagePayload);

    res.status(200).json({ updatedMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log(
      'Error in editMessage controller:',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Deletes a message based on selected type.
 * - "me": hides message for the current user only
 * - "everyone": marks message as deleted globally
 * Emits socket event to sync all clients.
 */
export const deleteMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, DeleteMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const { id: messageId } = req.params;
    const senderId = String(req.user);
    const deleteType = req.body.type;

    if (deleteType !== 'me' && deleteType !== 'everyone') {
      res.status(400).json({ error: 'Invalid delete type' });
      return;
    }

    const message = (await Message.findById(messageId)) as MessageDocument | null;
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const conversation = await getMessageConversation(messageId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const isSender = String(message.senderId) === senderId;
    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === senderId
    );

    if (deleteType === 'everyone') {
      // Only the original sender may remove a message for every participant.
      if (!isSender) {
        res.status(403).json({ error: 'You can only delete your own messages for everyone' });
        return;
      }
    } else if (!isParticipant) {
      // "me" only hides the message from the requester's own view, so any
      // current conversation participant may do this.
      res.status(403).json({ error: 'You are not a participant in this conversation' });
      return;
    }

    const deletedForEveryone = Boolean(
      (message as unknown as { deletedForEveryone?: boolean }).deletedForEveryone
    );
    const deletedFor = Array.isArray((message as unknown as { deletedFor?: unknown[] }).deletedFor)
      ? ((message as unknown as { deletedFor?: unknown[] }).deletedFor || []).map((value) =>
          String(value)
        )
      : [];

    if (deleteType === 'me') {
      if (deletedForEveryone || deletedFor.includes(senderId)) {
        const messageWithTimestamps = message as MessageDocument & {
          createdAt: Date;
          updatedAt: Date;
        };
        const realtimeMessagePayload = buildRealtimePayload(
          messageWithTimestamps,
          String(conversation._id)
        );

        emitMessageUpdateToParticipants('message:delete', conversation, realtimeMessagePayload);
        res.status(200).json({ updatedMessage: realtimeMessagePayload });
        return;
      }

      message.deletedFor = [...new Set([...deletedFor, senderId])].map(
        (userId) => new Types.ObjectId(userId)
      );
      await message.save();
    } else {
      if (deletedForEveryone) {
        try {
          await deleteCloudinaryAsset(message);
        } catch (cloudinaryError: unknown) {
          console.log(
            'Cloudinary cleanup failed for deleteMessage:',
            cloudinaryError instanceof Error ? cloudinaryError.message : String(cloudinaryError)
          );
        }

        const messageWithTimestamps = message as MessageDocument & {
          createdAt: Date;
          updatedAt: Date;
        };
        const realtimeMessagePayload = buildRealtimePayload(
          messageWithTimestamps,
          String(conversation._id)
        );

        emitMessageUpdateToParticipants('message:delete', conversation, realtimeMessagePayload);
        res.status(200).json({ updatedMessage: realtimeMessagePayload });
        return;
      }

      message.deletedForEveryone = true;
      // A pinned message can't keep showing deleted content in the pinned
      // banner/list once it's gone for everyone.
      message.pinned = false;
      message.pinnedAt = undefined;
      message.pinnedBy = undefined;
      await message.save();

      try {
        await deleteCloudinaryAsset(message);
      } catch (cloudinaryError: unknown) {
        console.log(
          'Cloudinary cleanup failed for deleteMessage:',
          cloudinaryError instanceof Error ? cloudinaryError.message : String(cloudinaryError)
        );
      }
    }

    const messageWithTimestamps = message as MessageDocument & {
      createdAt: Date;
      updatedAt: Date;
    };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    emitMessageUpdateToParticipants('message:delete', conversation, realtimeMessagePayload);

    res.status(200).json({ updatedMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log(
      'Error in deleteMessage controller:',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reactions aren't part of the E2EE guarantee (unlike message text), so a
// generous but bounded length check is enough to stop garbage/abuse input —
// compound emoji sequences (skin tone + ZWJ family combos) can run long.
const MAX_EMOJI_LENGTH = 32;

/**
 * Adds, replaces, or removes the requester's reaction on a message.
 * - Same emoji as the requester's existing reaction: removed (toggle off).
 * - Different emoji: replaces the requester's existing reaction.
 * - No existing reaction: adds a new one.
 * Any conversation participant (sender or receiver) may react.
 */
export const reactToMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, ReactToMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const { id: messageId } = req.params;
    const requesterId = String(req.user);
    const emoji = req.body.emoji?.trim();

    if (!emoji || emoji.length > MAX_EMOJI_LENGTH) {
      res.status(400).json({ error: 'A valid emoji is required' });
      return;
    }

    const message = (await Message.findById(messageId)) as MessageDocument | null;
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.deletedForEveryone) {
      res.status(400).json({ error: 'Deleted messages cannot be reacted to' });
      return;
    }

    const conversation = await getMessageConversation(messageId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === requesterId
    );
    if (!isParticipant) {
      res.status(403).json({ error: 'You are not a participant in this conversation' });
      return;
    }

    const existingReactions = Array.isArray(message.reactions) ? message.reactions : [];
    const existingReaction = existingReactions.find(
      (reaction) => String(reaction.userId) === requesterId
    );

    if (existingReaction && existingReaction.emoji === emoji) {
      // Same emoji tapped again: remove (toggle off).
      message.reactions = existingReactions.filter(
        (reaction) => String(reaction.userId) !== requesterId
      );
    } else {
      // No reaction yet, or a different emoji: add/replace.
      const otherReactions = existingReactions.filter(
        (reaction) => String(reaction.userId) !== requesterId
      );
      message.reactions = [...otherReactions, { userId: new Types.ObjectId(requesterId), emoji }];
    }

    await message.save();

    const messageWithTimestamps = message as MessageDocument & {
      createdAt: Date;
      updatedAt: Date;
    };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    emitMessageUpdateToParticipants('message:reaction', conversation, realtimeMessagePayload);

    res.status(200).json({ updatedMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log(
      'Error in reactToMessage controller:',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};

// Shared load/validate step for pin and unpin — any current conversation
// participant may pin/unpin (same openness as reactions, no admin-gating).
const loadMessageForPinAction = async (
  messageId: string,
  requesterId: string
): Promise<
  | { ok: true; message: MessageDocument; conversation: ConversationDocument }
  | { ok: false; status: number; error: string }
> => {
  const message = (await Message.findById(messageId)) as MessageDocument | null;
  if (!message) {
    return { ok: false, status: 404, error: 'Message not found' };
  }

  if (message.deletedForEveryone) {
    return { ok: false, status: 400, error: 'Deleted messages cannot be pinned' };
  }

  const conversation = await getMessageConversation(messageId);
  if (!conversation) {
    return { ok: false, status: 404, error: 'Conversation not found' };
  }

  const isParticipant = conversation.participants.some(
    (participantId) => String(participantId) === requesterId
  );
  if (!isParticipant) {
    return { ok: false, status: 403, error: 'You are not a participant in this conversation' };
  }

  return { ok: true, message, conversation };
};

/**
 * Pins a message within its conversation. Any current participant may pin.
 */
export const pinMessage = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const { id: messageId } = req.params;
    const requesterId = String(req.user);

    const result = await loadMessageForPinAction(messageId, requesterId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { message, conversation } = result;
    message.pinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = new Types.ObjectId(requesterId);
    await message.save();

    const messageWithTimestamps = message as MessageDocument & { createdAt: Date; updatedAt: Date };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    emitMessageUpdateToParticipants('message:pin', conversation, realtimeMessagePayload);

    res.status(200).json({ updatedMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log('Error in pinMessage controller:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Unpins a message within its conversation. Any current participant may unpin.
 */
export const unpinMessage = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const { id: messageId } = req.params;
    const requesterId = String(req.user);

    const result = await loadMessageForPinAction(messageId, requesterId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { message, conversation } = result;
    message.pinned = false;
    message.pinnedAt = undefined;
    message.pinnedBy = undefined;
    await message.save();

    const messageWithTimestamps = message as MessageDocument & { createdAt: Date; updatedAt: Date };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    emitMessageUpdateToParticipants('message:pin', conversation, realtimeMessagePayload);

    res.status(200).json({ updatedMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log('Error in unpinMessage controller:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};