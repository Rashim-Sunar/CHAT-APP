// ----------------------------------------
// @file   storyModel.ts
// @desc   Defines story/status documents with 24-hour expiry
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export type StoryType = 'image' | 'video' | 'text';
export type StoryPrivacy = 'everyone' | 'close_friends';

export interface IStory {
  user: Types.ObjectId;
  type: StoryType;
  mediaUrl?: string;
  publicId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string;
  text?: string;
  textAlign?: 'left' | 'center' | 'right';
  background?: string;
  privacy: StoryPrivacy;
  expiresAt: Date;
}

export type StoryDocument = IStory & Document;

const storySchema = new mongoose.Schema<IStory>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    publicId: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    caption: {
      type: String,
      trim: true,
      default: '',
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    textAlign: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center',
    },
    background: {
      type: String,
      default: 'purple-gradient',
    },
    privacy: {
      type: String,
      enum: ['everyone', 'close_friends'],
      default: 'everyone',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

storySchema.index({ user: 1, createdAt: -1 });

const Story = mongoose.model('story', storySchema);

export default Story;
