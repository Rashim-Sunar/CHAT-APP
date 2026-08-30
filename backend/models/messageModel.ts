// ----------------------------------------
// @file   messageModel.ts
// @desc   Defines schema for storing individual chat messages
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

// 'call_log' is a system message (no sender-authored content) summarizing a
// finished call — distinct from 'video', which is an uploaded video FILE
// message. Do not conflate the two.
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'call_log';
export type CallType = 'audio' | 'video';
export type CallStatus = 'missed' | 'declined' | 'ended';

export interface IMessageReaction {
  userId: Types.ObjectId;
  emoji: string;
}

export interface IEncryptedAesKeyEntry {
  userId: Types.ObjectId;
  wrappedKey: string;
}

export interface IMessage {
  senderId: Types.ObjectId;
  // Real routing FK for both direct and group messages — the primary way a
  // message's parent conversation is resolved (replacing the old reverse
  // `Conversation.findOne({messages: messageId})` lookup). Not marked
  // `required` at the schema level yet: pre-migration documents won't have
  // it populated until the backfill script runs (see backend/scripts/).
  conversationId?: Types.ObjectId;
  // Kept for direct messages only (populated for display/back-compat
  // convenience); left unset for group messages, which have no single
  // recipient. Membership/authorization checks use conversation
  // participants, not this field — see messageController.ts.
  receiverId?: Types.ObjectId;
  messageType: MessageType;
  text?: string;
  encryptedMessage?: string;
  // Legacy single-string dual-wrap envelope (`{"receiver":"...","sender":"..."}`),
  // kept for rollback safety during the schema migration. New code should
  // read/write `encryptedAESKeys` instead. Remove in a follow-up cleanup
  // once the new format is confirmed stable.
  encryptedAESKey?: string;
  // One RSA-wrapped AES key entry per recipient at send time — 2 entries for
  // a direct message (receiver + sender's own copy), N entries for a group
  // (every current member). Not marked `required` yet for the same
  // migration-window reason as `conversationId`.
  encryptedAESKeys?: IEncryptedAesKeyEntry[];
  iv?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  edited?: boolean;
  editedAt?: Date;
  deletedForEveryone?: boolean;
  deletedFor?: Types.ObjectId[];
  reactions?: IMessageReaction[];
  replyTo?: Types.ObjectId;
  forwarded?: boolean;
  // Only set when messageType === 'call_log'.
  callType?: CallType;
  callStatus?: CallStatus;
  callDurationSec?: number;
  pinned?: boolean;
  pinnedAt?: Date;
  pinnedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Extends IMessage with mongoose document properties
export type MessageDocument = IMessage & Document;

// ----------------------------------------
// Message Schema Definition
// ----------------------------------------
const messageSchema = new mongoose.Schema<IMessage>(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // Reference to sender user document
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'conversation',
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // Reference to receiver user document (direct messages only)
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'call_log'],
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    encryptedMessage: {
      type: String,
      trim: true,
    },
    encryptedAESKey: {
      type: String,
      trim: true,
    },
    encryptedAESKeys: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
          required: true,
        },
        wrappedKey: {
          type: String,
          required: true,
        },
        _id: false,
      },
    ],
    iv: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
      },
    ],
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
        _id: false,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'message',
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
    callType: {
      type: String,
      enum: ['audio', 'video'],
    },
    callStatus: {
      type: String,
      enum: ['missed', 'declined', 'ended'],
    },
    callDurationSec: {
      type: Number,
      min: 0,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    },
  },
  { timestamps: true } // Adds createdAt & updatedAt for message tracking
);

// Supports fast pair-wise message lookups sorted by newest first (legacy,
// still used as a fallback path during the conversationId migration window).
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

// Primary lookup path going forward: conversation history and sidebar
// preview aggregation both query/group by conversationId.
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Supports filtering recent messages by content category for details side panel.
messageSchema.index({ messageType: 1, createdAt: -1 });

// Supports the pinned-messages panel/banner query.
messageSchema.index({ conversationId: 1, pinned: 1, pinnedAt: -1 });

// Create and export Message model
const Message = mongoose.model('message', messageSchema);

export default Message;
