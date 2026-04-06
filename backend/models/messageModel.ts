// ----------------------------------------
// @file   messageModel.ts
// @desc   Defines schema for storing individual chat messages
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'video' | 'file';

export interface IMessage {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  messageType: MessageType;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  edited?: boolean;
  editedAt?: Date;
  deletedForEveryone?: boolean;
  deletedFor?: Types.ObjectId[];
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
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // Reference to receiver user document
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file'],
      required: true,
    },
    text: {
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
  },
  { timestamps: true } // Adds createdAt & updatedAt for message tracking
);

// Supports fast pair-wise message lookups sorted by newest first.
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

// Supports filtering recent messages by content category for details side panel.
messageSchema.index({ messageType: 1, createdAt: -1 });

// Create and export Message model
const Message = mongoose.model('message', messageSchema);

export default Message;