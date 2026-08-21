// ----------------------------------------
// @file   storyViewModel.ts
// @desc   Tracks which users viewed which stories
// ----------------------------------------

import mongoose, { Document, Types } from 'mongoose';

export interface IStoryView {
  story: Types.ObjectId;
  viewer: Types.ObjectId;
  viewedAt: Date;
}

export type StoryViewDocument = IStoryView & Document;

const storyViewSchema = new mongoose.Schema<IStoryView>(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'story',
      required: true,
      index: true,
    },
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true });

const StoryView = mongoose.model('story_view', storyViewSchema);

export default StoryView;
