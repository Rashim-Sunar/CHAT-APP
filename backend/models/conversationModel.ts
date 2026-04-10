// ----------------------------------------
// @file   conversationModel.ts
// @desc   Defines schema for conversations between users
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export interface IConversation {
  participants: Types.ObjectId[];
  messages: Types.ObjectId[];
  readBy: {
    userId: Types.ObjectId;
    seenAt: Date;
  }[];
}

// Extends IConversation with mongoose document properties
export type ConversationDocument = IConversation & Document;

// ----------------------------------------
// Conversation Schema Definition
// ----------------------------------------
const conversationSchema = new mongoose.Schema<IConversation>(
  {
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
  },
  { timestamps: true } // Adds createdAt & updatedAt for conversation tracking
);

// Helps conversation lookup by participants in message send/read operations.
conversationSchema.index({ participants: 1 });

// Create and export Conversation model
const Conversation = mongoose.model('conversation', conversationSchema);

export default Conversation;