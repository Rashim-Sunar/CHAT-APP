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
import type { CreateFileDeliveryUrlDto, CreateUploadSignatureDto, SendMessageDto } from '../types/dtos/message.js';
import { getCloudinary } from '../Utils/cloudinary.js';
import {
  sanitizeFileName,
  validateFilePayload,
  resolveMessageTypeFromMime,
  resolveCloudinaryResourceType,
  getMaxUploadSizeBytes,
} from '../Utils/fileValidation.js';

const getFileFormat = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Cloudinary's private_download_url requires a format hint for raw assets.
  // If a file has no extension, fall back to a generic binary payload.
  return extension || 'bin';
};

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
  publicId: string | null;
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
//
// This is the normalization boundary for the entire chat system. Any payload
// leaving the backend should already contain the exact fields the frontend
// needs to render the message without guessing which legacy field name to use.
// Keeping this logic centralized also prevents REST responses and socket
// events from drifting apart over time.
const buildRealtimePayload = (
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
    publicId: typeof (messageDoc as unknown as { publicId?: unknown }).publicId === 'string'
      ? ((messageDoc as unknown as { publicId?: string }).publicId as string)
      : null,
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
      publicId: payload.publicId,
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