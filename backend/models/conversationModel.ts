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
  // Per-member provenance for the group info panel ("Added by X") — kept as
  // a separate parallel array rather than folded into `participants` itself,
  // so every existing participants-array read/write (auth checks, $in
  // queries, populate calls) across the codebase stays untouched.
  memberMeta?: {
    userId: Types.ObjectId;
    addedBy?: Types.ObjectId;
    joinedAt: Date;
  }[];
  // Stores a hash of the invite token, never the plaintext — it's a bearer
  // secret meant to be shared broadly (e.g. pasted into a chat), so its
  // threat model is closer to a password-reset token than a session id.
  inviteTokenHash?: string;
  inviteTokenExpiresAt?: Date | null;
  // Per-user notification mute — works identically for direct and group,
  // silent to every other participant (only ever synced back to the muting
  // user's own other devices).
  mutedBy?: Types.ObjectId[];
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
    memberMeta: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inviteTokenHash: {
      type: String,
    },
    inviteTokenExpiresAt: {
      type: Date,
      default: null,
    },
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
      },
    ],
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
