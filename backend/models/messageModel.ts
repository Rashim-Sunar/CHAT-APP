// ----------------------------------------
// @file   messageModel.ts
// @desc   Defines schema for storing individual chat messages
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export interface IMessage {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
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
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // Reference to receiver user document
      required: true,
    },
    message: {
      type: String,
      required: true, // Stores actual message content
    },
  },
  { timestamps: true } // Adds createdAt & updatedAt for message tracking
);

// Create and export Message model
const Message = mongoose.model('message', messageSchema);

export default Message;