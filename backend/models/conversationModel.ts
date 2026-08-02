// ----------------------------------------
// @file   conversationModel.ts
// @desc   Defines schema for conversations between users (direct and group)
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export type ConversationType = 'direct' | 'group';

export interface IConversation {
  type: ConversationType;
  participants: Types.ObjectId[];
  messages: Types.ObjectId[];
  readBy: {
    userId: Types.ObjectId;
    seenAt: Date;
  }[];
  // Group-only fields.
  groupName?: string;
  groupAvatar?: string;
  groupAdmins?: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  // Stores a hash of the invite token, never the plaintext — it's a bearer
  // secret meant to be shared broadly (e.g. pasted into a chat), so its
  // threat model is closer to a password-reset token than a session id.
  inviteTokenHash?: string;
  inviteTokenExpiresAt?: Date | null;
}

// Extends IConversation with mongoose document properties
export type ConversationDocument = IConversation & Document;

// ----------------------------------------
// Conversation Schema Definition
// ----------------------------------------
const conversationSchema = new mongoose.Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      default: 'direct',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // References users involved in the conversation
      },
    ],
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'message', // References messages belonging to this conversation
        default: [],
      },
    ],
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
        },
        seenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      trim: true,
    },
    groupAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    },
    inviteTokenHash: {
      type: String,
    },
    inviteTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // Adds createdAt & updatedAt for conversation tracking
);

// Helps conversation lookup by participants in message send/read operations.
conversationSchema.index({ participants: 1 });

// Helps the sidebar list a user's conversations filtered/sorted by type.
conversationSchema.index({ type: 1, participants: 1 });

// Create and export Conversation model
const Conversation = mongoose.model('conversation', conversationSchema);

export default Conversation;
