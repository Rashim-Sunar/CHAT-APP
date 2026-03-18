// ----------------------------------------
// @file   conversationModel.ts
// @desc   Defines schema for conversations between users
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export interface IConversation {
  participants: Types.ObjectId[];
  messages: Types.ObjectId[];
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
  },
  { timestamps: true } // Adds createdAt & updatedAt for conversation tracking
);

// Create and export Conversation model
const Conversation = mongoose.model('conversation', conversationSchema);

export default Conversation;