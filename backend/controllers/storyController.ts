// ----------------------------------------
// @file   storyController.ts
// @desc   Handles story creation, retrieval, views, and deletion
// ----------------------------------------

import type { Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Story, { type StoryDocument } from '../models/storyModel.js';
import StoryView from '../models/storyViewModel.js';
import User from '../models/userModel.js';
import { io } from '../socket/socket.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type { CreateStoryDto, CreateStoryUploadSignatureDto } from '../types/dtos/story.js';
import {
  getCloudinary,
} from '../Utils/cloudinary.js';
import {
  sanitizeFileName,
  validateFilePayload,
  resolveCloudinaryResourceType,
} from '../Utils/fileValidation.js';
import { isCloudinaryPathValidForType, isCloudinaryUrl } from './messageController.js';

const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000;

type StoryLeanUser = {
  _id: mongoose.Types.ObjectId;
  userName: string;
  gender: string;
  profilePic?: string;
};

type StoryLean = {
  _id: mongoose.Types.ObjectId;
  user: StoryLeanUser;
  type: 'image' | 'video' | 'text';
  mediaUrl?: string;
  publicId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string;
  text?: string;
  textAlign?: 'left' | 'center' | 'right';
  background?: string;
  privacy: 'everyone' | 'close_friends';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const isValidStoryType = (type: unknown): type is CreateStoryDto['type'] =>
  type === 'image' || type === 'video' || type === 'text';

const isValidPrivacy = (privacy: unknown): privacy is NonNullable<CreateStoryDto['privacy']> =>
  privacy === undefined || privacy === 'everyone' || privacy === 'close_friends';

const getStoryPublicId = (userId: string, fileName: string): string => {
  const safeName = sanitizeFileName(fileName);
  return `story_uploads/${userId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;
};

const serializeStory = (
  story: StoryLean,
  viewedByMe: boolean,
  currentUserId: string
): Record<string, unknown> => ({
  _id: String(story._id),
  userId: String(story.user._id),
  user: {
    _id: String(story.user._id),
    userName: story.user.userName,
    gender: story.user.gender,
    profilePic: story.user.profilePic,
  },
  type: story.type,
  mediaUrl: story.mediaUrl || null,
  publicId: story.publicId || null,
  fileName: story.fileName || null,
  fileSize: story.fileSize || null,
  mimeType: story.mimeType || null,
  caption: story.caption || '',
  text: story.text || '',
  textAlign: story.textAlign || 'center',
  background: story.background || 'purple-gradient',
  privacy: story.privacy,
  expiresAt: story.expiresAt,
  createdAt: story.createdAt,
  updatedAt: story.updatedAt,
  viewedByMe,
  isOwn: String(story.user._id) === String(currentUserId),
});

const emitStoryEvent = (eventName: 'story:created' | 'story:viewed' | 'story:deleted', payload: Record<string, unknown>) => {
  io.emit(eventName, payload);
};

/**
 * @desc    Creates a short-lived, signed Cloudinary upload contract for stories
 * @route   POST /api/stories/upload-signature
 * @access  Private
 */
export const createStoryUploadSignature = async (
  req: AuthenticatedRequest<unknown, unknown, CreateStoryUploadSignatureDto>,
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
    if (resourceType !== 'image' && resourceType !== 'video') {
      res.status(400).json({ error: 'Stories only support image and video uploads' });
      return;
    }

    const cloudinary = getCloudinary();
    const timestamp = Math.floor(Date.now() / 1000);
    const senderId = String(req.user || 'unknown');
    const publicId = getStoryPublicId(senderId, fileName);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        public_id: publicId,
        access_mode: 'public',
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      status: 'success',
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        publicId,
        resourceType,
        accessMode: 'public',
        maxFileSizeBytes: undefined,
      },
    });
  } catch (error: unknown) {
    console.log('Error in createStoryUploadSignature:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc    Creates a new story for the authenticated user
 * @route   POST /api/stories
 * @access  Private
 */
export const createStory = async (
  req: AuthenticatedRequest<unknown, unknown, CreateStoryDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user || '');
    const { type, caption = '', text = '', textAlign = 'center', background = 'purple-gradient', privacy = 'everyone', mediaUrl, fileName, fileSize, mimeType, publicId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!isValidStoryType(type)) {
      res.status(400).json({ error: 'Invalid story type' });
      return;
    }

    if (!isValidPrivacy(privacy)) {
      res.status(400).json({ error: 'Invalid story privacy' });
      return;
    }

    const normalizedCaption = String(caption || '').trim();
    const normalizedText = String(text || '').trim();

    if (type === 'text') {
      if (!normalizedText) {
        res.status(400).json({ error: 'Text story cannot be empty' });
        return;
      }

      if (!['left', 'center', 'right'].includes(textAlign)) {
        res.status(400).json({ error: 'Invalid text alignment' });
        return;
      }
    } else {
      if (!mediaUrl || !fileName || !mimeType || !fileSize || !publicId) {
        res.status(400).json({ error: 'Media story requires uploaded file metadata' });
        return;
      }

      const fileValidation = validateFilePayload(fileName, mimeType, Number(fileSize));
      if (!fileValidation.valid) {
        res.status(400).json({ error: fileValidation.reason });
        return;
      }

      if (!isCloudinaryUrl(mediaUrl)) {
        res.status(400).json({ error: 'Invalid media host' });
        return;
      }

      if (!isCloudinaryPathValidForType(mediaUrl, type)) {
        res.status(400).json({ error: 'Media URL resource type mismatch' });
        return;
      }
    }

    const expiresAt = new Date(Date.now() + STORY_EXPIRY_MS);

    const story = await Story.create({
      user: userId,
      type,
      mediaUrl: type === 'text' ? undefined : mediaUrl,
      publicId: type === 'text' ? undefined : publicId,
      fileName: type === 'text' ? undefined : fileName,
      fileSize: type === 'text' ? undefined : fileSize,
      mimeType: type === 'text' ? undefined : mimeType,
      caption: normalizedCaption,
      text: type === 'text' ? normalizedText : normalizedText,
      textAlign: type === 'text' ? textAlign : undefined,
      background: type === 'text' ? background : undefined,
      privacy,
      expiresAt,
    });

    const populatedStory = (await Story.findById(story._id).populate('user', 'userName gender profilePic')) as unknown as StoryLean | null;
    if (!populatedStory) {
      res.status(500).json({ error: 'Failed to create story' });
      return;
    }

    emitStoryEvent('story:created', { storyId: String(story._id), userId });

    res.status(201).json({
      status: 'success',
      data: {
        story: serializeStory(populatedStory, true, userId),
      },
    });
  } catch (error: unknown) {
    console.log('Error in createStory:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc    Retrieves active stories grouped by user
 * @route   GET /api/stories
 * @access  Private
 */
export const getStories = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = String(req.user || '');
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const now = new Date();
    const activeStories = (await Story.find({ expiresAt: { $gt: now } })
      .populate('user', 'userName gender profilePic')
      .sort({ createdAt: 1 })
      .lean()) as unknown as StoryLean[];

    const storyIds = activeStories.map((story) => story._id);
    const viewDocs = await StoryView.find({
      viewer: currentUserId,
      story: { $in: storyIds },
    }).lean();

    const viewedStoryIds = new Set(viewDocs.map((view) => String(view.story)));
    const groupedByUser = new Map<string, { user: StoryLeanUser; stories: Record<string, unknown>[]; hasUnseenStory: boolean; latestStoryAt: string }>();

    activeStories.forEach((story) => {
      const userId = String(story.user._id);
      const viewedByMe = userId === currentUserId || viewedStoryIds.has(String(story._id));
      const group = groupedByUser.get(userId) || {
        user: {
          _id: story.user._id,
          userName: story.user.userName,
          gender: story.user.gender,
          profilePic: story.user.profilePic,
        },
        stories: [],
        hasUnseenStory: false,
        latestStoryAt: story.createdAt.toISOString(),
      };

      group.stories.push(serializeStory(story, viewedByMe, currentUserId));
      group.hasUnseenStory = group.hasUnseenStory || !viewedByMe;
      group.latestStoryAt = story.createdAt.toISOString();
      groupedByUser.set(userId, group);
    });

    const stories = Array.from(groupedByUser.values()).sort((first, second) => {
      const firstIsOwn = String(first.user._id) === currentUserId;
      const secondIsOwn = String(second.user._id) === currentUserId;
      if (firstIsOwn !== secondIsOwn) return firstIsOwn ? -1 : 1;
      if (first.hasUnseenStory !== second.hasUnseenStory) return first.hasUnseenStory ? -1 : 1;
      return new Date(second.latestStoryAt).getTime() - new Date(first.latestStoryAt).getTime();
    });

    res.status(200).json({
      status: 'success',
      data: { stories },
    });
  } catch (error: unknown) {
    console.log('Error in getStories:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc    Retrieves a single active story
 * @route   GET /api/stories/:storyId
 * @access  Private
 */
export const getStory = async (
  req: AuthenticatedRequest<{ storyId: string }>,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = String(req.user || '');
    const { storyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      res.status(400).json({ error: 'Invalid story id' });
      return;
    }

    const story = (await Story.findOne({ _id: storyId, expiresAt: { $gt: new Date() } })
      .populate('user', 'userName gender profilePic')
      .lean()) as unknown as StoryLean | null;

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (String(story.user._id) !== currentUserId && story.privacy !== 'everyone') {
      res.status(403).json({ error: 'Story is not available' });
      return;
    }

    const viewedByMe = String(story.user._id) === currentUserId || Boolean(
      await StoryView.exists({ story: story._id, viewer: currentUserId })
    );

    res.status(200).json({
      status: 'success',
      data: {
        story: serializeStory(story, viewedByMe, currentUserId),
      },
    });
  } catch (error: unknown) {
    console.log('Error in getStory:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc    Marks a story as viewed by the authenticated user
 * @route   POST /api/stories/:storyId/view
 * @access  Private
 */
export const viewStory = async (
  req: AuthenticatedRequest<{ storyId: string }>,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = String(req.user || '');
    const { storyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      res.status(400).json({ error: 'Invalid story id' });
      return;
    }

    const story = await Story.findOne({ _id: storyId, expiresAt: { $gt: new Date() } }).lean();
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (String(story.user) !== currentUserId && story.privacy !== 'everyone') {
      res.status(403).json({ error: 'Story is not available' });
      return;
    }

    await StoryView.updateOne(
      { story: storyId, viewer: currentUserId },
      { $setOnInsert: { viewedAt: new Date() } },
      { upsert: true }
    );

    emitStoryEvent('story:viewed', { storyId, viewerId: currentUserId });

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in viewStory:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc    Deletes a story owned by the authenticated user
 * @route   DELETE /api/stories/:storyId
 * @access  Private
 */
export const deleteStory = async (
  req: AuthenticatedRequest<{ storyId: string }>,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = String(req.user || '');
    const { storyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      res.status(400).json({ error: 'Invalid story id' });
      return;
    }

    const story = await Story.findById(storyId);
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (String(story.user) !== currentUserId) {
      res.status(403).json({ error: 'You can only delete your own story' });
      return;
    }

    await Promise.all([
      Story.deleteOne({ _id: storyId }),
      StoryView.deleteMany({ story: storyId }),
    ]);

    emitStoryEvent('story:deleted', { storyId, userId: currentUserId });

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in deleteStory:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};
