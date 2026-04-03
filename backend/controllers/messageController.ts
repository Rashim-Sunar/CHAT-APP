// ----------------------------------------
// @file   messageController.ts
// @desc   Handles messaging functionality (send & retrieve messages)
// ----------------------------------------

import type { Response } from 'express';
import crypto from 'crypto';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';
import Message, { MessageDocument } from '../models/messageModel.js';
import { getReceiverSocketId, io } from '../socket/socket.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type { CreateUploadSignatureDto, SendMessageDto } from '../types/dtos/message.js';
import { getCloudinary } from '../Utils/cloudinary.js';
import {
  sanitizeFileName,
  validateFilePayload,
  resolveMessageTypeFromMime,
  resolveCloudinaryResourceType,
  getMaxUploadSizeBytes,
} from '../Utils/fileValidation.js';

type RealtimeMessagePayload = {
  _id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  messageType: 'text' | 'image' | 'video' | 'file';
  text: string;
  message: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Enforce Cloudinary-owned asset URLs only. This prevents clients from sending
// arbitrary third-party links as media attachments.
const isCloudinaryUrl = (url: string): boolean => {
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
const isCloudinaryPathValidForType = (
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
// Keeping this centralized guarantees frontend parsing consistency across transports.
const buildRealtimePayload = (
  messageDoc: MessageDocument & { createdAt: Date; updatedAt: Date },
  conversationId: string
): RealtimeMessagePayload => {
  // Backward compatibility: older documents used `message` instead of `text`
  // and may not have messageType set. Keep history readable after migration.
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

  return {
    _id: String(messageDoc._id),
    senderId: String(messageDoc.senderId),
    receiverId: String(messageDoc.receiverId),
    conversationId,
    messageType: normalizedMessageType,
    text: normalizedText,
    // Backward-compatible field for existing clients still reading `message`.
    message: normalizedText,
    fileUrl: messageDoc.fileUrl || null,
    fileName: messageDoc.fileName || null,
    fileSize: typeof messageDoc.fileSize === 'number' ? messageDoc.fileSize : null,
    mimeType: messageDoc.mimeType || null,
    createdAt: messageDoc.createdAt,
    updatedAt: messageDoc.updatedAt,
  };
};

// Validates and normalizes payloads for text/media messages before persistence.
// This guards against malformed clients and enforces server-side trust boundaries.
const validateSendPayload = (
  body: SendMessageDto
): { valid: true; payload: Required<Pick<SendMessageDto, 'messageType'>> & SendMessageDto } | { valid: false; reason: string } => {
  const messageType = body.messageType || 'text';
  const rawText = (body.text ?? body.message ?? '').trim();

  if (messageType === 'text') {
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

    // Signature only includes immutable fields we want clients to use.
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        public_id: publicId,
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

    // Persist exactly one message document shape for all message types.
    const newMessage = new Message({
      senderId,
      receiverId,
      messageType: payload.messageType,
      text: payload.text,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
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

    // Emit to receiver socket only; sender appends via HTTP response path.
    // This avoids duplicate local rendering for the sender.
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', realtimeMessagePayload);
    }

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

    const messages = (conversation.messages as unknown as MessageDocument[]).map((messageDoc) => {
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