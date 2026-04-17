// ----------------------------------------
// @file   userController.ts
// @desc   Handles user-related operations (e.g., fetching users for sidebar)
// ----------------------------------------

import type { Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Conversation from '../models/conversationModel.js';
import User from '../models/userModel.js';
import Message from '../models/messageModel.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type { UpdateUserNameDto } from '../types/dtos/profile.js';
import { getCloudinary } from '../Utils/cloudinary.js';

type SidebarMessageAggregate = {
  _id: mongoose.Types.ObjectId;
  lastMessageType?: 'text' | 'image' | 'video' | 'file';
  lastText?: string;
  lastEncryptedMessage?: string;
  lastFileName?: string;
  lastCreatedAt?: Date;
  lastSenderId?: mongoose.Types.ObjectId;
  lastDeletedForEveryone?: boolean;
  lastDeletedFor?: mongoose.Types.ObjectId[];
  unreadCount?: number;
};

type SidebarConversationRecord = {
  participants: Array<mongoose.Types.ObjectId | string>;
  messages: Array<{
    senderId: mongoose.Types.ObjectId | string;
    receiverId: mongoose.Types.ObjectId | string;
    messageType: 'text' | 'image' | 'video' | 'file';
    text?: string;
    encryptedMessage?: string;
    fileName?: string;
    deletedForEveryone?: boolean;
    deletedFor?: Array<mongoose.Types.ObjectId | string>;
    createdAt: Date | string;
  }>;
  readBy?: Array<{
    userId: mongoose.Types.ObjectId | string;
    seenAt: Date | string;
  }>;
};

type UserDetailsResponse = {
  user: {
    _id: string;
    username: string;
    profilePic?: string;
    status: 'online' | 'offline';
  };
  media: Array<{
    url: string;
    type: 'image' | 'video';
    createdAt: Date;
  }>;
  links: Array<{
    url: string;
    title: string;
    createdAt: Date;
  }>;
  documents: Array<{
    name: string;
    url: string;
    size?: number;
    createdAt: Date;
  }>;
};

const MAX_ITEMS_PER_SECTION = 120;
const MAX_LINK_SOURCE_MESSAGES = 300;
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Visibility guard shared across details/sidebar builders.
// Messages deleted for everyone are hidden from these derived collections,
// and per-user deletions are filtered against the current viewer id.
const isVisibleToUser = (message: { deletedForEveryone?: boolean; deletedFor?: unknown[] }, userId: string): boolean => {
  if (message.deletedForEveryone) return false;

  const deletedFor = Array.isArray(message.deletedFor) ? message.deletedFor.map((value) => String(value)) : [];
  return !deletedFor.includes(String(userId));
};

// Strip trailing punctuation often included by natural typing so links remain valid.
const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim().replace(/[),.;!?]+$/g, '');
  return trimmed;
};

// Build a compact, human-readable link title from the URL.
// Falls back to raw input when parsing fails so we never drop data.
const buildLinkTitle = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;

    if (!path) return host;

    const readablePath = decodeURIComponent(path)
      .replace(/[-_]/g, ' ')
      .replace(/\/+$/, '');

    return `${host}${readablePath}`;
  } catch {
    return rawUrl;
  }
};

// Message-summary fallback used when conversation documents are not hydrated yet.
// For encrypted text, the backend intentionally returns a generic label.
const getSidebarMessagePreview = (
  summary: SidebarMessageAggregate | undefined,
  loggedinUserId: string
): string => {
  if (!summary) return '';

  const deletedForEveryone = Boolean(summary.lastDeletedForEveryone);
  const deletedFor = Array.isArray(summary.lastDeletedFor)
    ? summary.lastDeletedFor.map((value) => String(value))
    : [];

  if (deletedFor.includes(String(loggedinUserId))) {
    return '';
  }

  if (deletedForEveryone) {
    return 'This message was deleted';
  }

  if (summary.lastMessageType === 'text') {
    if (summary.lastEncryptedMessage) {
      return 'Encrypted message';
    }

    return (summary.lastText || '').trim();
  }

  if (summary.lastMessageType === 'image') return 'Sent an image';
  if (summary.lastMessageType === 'video') return 'Sent a video';
  if (summary.lastMessageType === 'file') return summary.lastFileName || 'Sent a file';

  return '';
};

// Sidebar-specific visibility check used during unread and preview derivation.
const isMessageVisibleForSidebar = (
  message: SidebarConversationRecord['messages'][number],
  userId: string
): boolean => {
  const deletedFor = Array.isArray(message.deletedFor)
    ? message.deletedFor.map((value) => String(value))
    : [];

  return !deletedFor.includes(String(userId));
};

// Convert a message record into a sidebar-safe preview string.
// This keeps media labels and encrypted placeholders consistent across clients.
const getSidebarPreviewText = (
  message: SidebarConversationRecord['messages'][number] | undefined
): string => {
  if (!message) return '';

  if (message.deletedForEveryone) {
    return 'This message was deleted';
  }

  if (message.messageType === 'text') {
    if (message.encryptedMessage) {
      return 'Encrypted message';
    }

    return (message.text || '').trim();
  }

  if (message.messageType === 'image') return 'Sent an image';
  if (message.messageType === 'video') return 'Sent a video';
  if (message.messageType === 'file') return message.fileName || 'Sent a file';

  return '';
};

/**
 * @desc    Retrieves all users except the logged-in user (for sidebar display)
 * @route   GET /api/users
 * @access  Private
 * @returns JSON response with list of users
 */
export const getUsersForSidebar = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Extract authenticated user ID (attached via auth middleware)
    const loggedinUserId = req.user;

    if (!loggedinUserId || !mongoose.Types.ObjectId.isValid(loggedinUserId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    const loggedinObjectId = new mongoose.Types.ObjectId(loggedinUserId);

    // Step 1: collect users + latest message summaries + conversation snapshots in parallel.
    // Running these concurrently keeps sidebar load latency predictable.
    const [filteredUsers, messageSummaries, conversations] = await Promise.all([
      User.find({ _id: { $ne: loggedinUserId } }),
      Message.aggregate<SidebarMessageAggregate>([
        {
          $match: {
            $or: [{ senderId: loggedinObjectId }, { receiverId: loggedinObjectId }],
          },
        },
        {
          $addFields: {
            partnerId: {
              $cond: [{ $eq: ['$senderId', loggedinObjectId] }, '$receiverId', '$senderId'],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$partnerId',
            lastMessageType: { $first: '$messageType' },
            lastText: { $first: '$text' },
            lastEncryptedMessage: { $first: '$encryptedMessage' },
            lastFileName: { $first: '$fileName' },
            lastCreatedAt: { $first: '$createdAt' },
            lastSenderId: { $first: '$senderId' },
            lastDeletedForEveryone: { $first: '$deletedForEveryone' },
            lastDeletedFor: { $first: { $ifNull: ['$deletedFor', []] } },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$receiverId', loggedinObjectId] },
                      { $ne: ['$deletedForEveryone', true] },
                      { $not: [{ $in: [loggedinObjectId, { $ifNull: ['$deletedFor', []] }] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Conversation.find({ participants: loggedinObjectId })
        .populate('messages')
        .lean<SidebarConversationRecord[]>(),
    ]);

    // Step 2: index pre-fetched data by partner id for O(1) joins during mapping.
    const summaryByPartnerId = new Map(
      messageSummaries.map((summary) => [String(summary._id), summary])
    );

    const conversationByPartnerId = new Map<string, SidebarConversationRecord>();
    conversations.forEach((conversation) => {
      const partnerId = conversation.participants
        .map((participant) => String(participant))
        .find((participantId) => participantId !== String(loggedinUserId));

      if (partnerId) {
        conversationByPartnerId.set(partnerId, conversation);
      }
    });

    // Step 3: build final sidebar payload with preview, sender marker, and unread counters.
    const usersWithPreview = filteredUsers.map((userDoc) => {
      const user = userDoc.toObject();
      const summary = summaryByPartnerId.get(String(userDoc._id));
      const conversation = conversationByPartnerId.get(String(userDoc._id));
      const readState = conversation?.readBy?.find(
        (entry) => String(entry.userId) === String(loggedinUserId)
      );
      const seenAt = readState?.seenAt ? new Date(readState.seenAt) : new Date(0);

      const sortedMessages = Array.isArray(conversation?.messages)
        ? [...conversation.messages].sort(
            (firstMessage, secondMessage) =>
              new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime()
          )
        : [];

      let lastVisibleMessage: SidebarConversationRecord['messages'][number] | undefined;
      for (let index = sortedMessages.length - 1; index >= 0; index -= 1) {
        const message = sortedMessages[index];
        if (isMessageVisibleForSidebar(message, String(loggedinUserId))) {
          lastVisibleMessage = message;
          break;
        }
      }

      const lastMessage = getSidebarPreviewText(lastVisibleMessage) || getSidebarMessagePreview(summary, loggedinUserId);
      const lastMessageAt = lastVisibleMessage?.createdAt || summary?.lastCreatedAt || undefined;
      const lastMessageSenderId = lastVisibleMessage?.senderId
        ? String(lastVisibleMessage.senderId)
        : summary?.lastSenderId
          ? String(summary.lastSenderId)
          : undefined;

      const unreadCount = sortedMessages.reduce((count, message) => {
        if (String(message.receiverId) !== String(loggedinUserId)) return count;
        if (!isMessageVisibleForSidebar(message, String(loggedinUserId))) return count;
        if (new Date(message.createdAt).getTime() <= seenAt.getTime()) return count;
        return count + 1;
      }, 0);

      return {
        ...user,
        lastMessage,
        lastMessageAt,
        lastMessageSenderId,
        seenAt: readState?.seenAt ? new Date(readState.seenAt).toISOString() : undefined,
        unreadCount,
      };
    });

    res.status(200).json({
      status: 'success',
      users: usersWithPreview.length,
      data: {
        users: usersWithPreview,
      },
    });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error in getUserForSidebar',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Stores authenticated user's public key used by peers for E2EE
 * @route   POST /api/users/public-key
 * @access  Private
 */
export const savePublicKey = async (
  req: AuthenticatedRequest<unknown, unknown, { publicKey?: Record<string, unknown> }>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { publicKey } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    // Basic shape guard only: JWK validation is delegated to clients on import,
    // while the server remains storage-only for public keys.
    if (!publicKey || typeof publicKey !== 'object') {
      res.status(400).json({
        status: 'fail',
        message: 'publicKey is required',
      });
      return;
    }

    // E2EE constraint: only public keys are persisted. The server never stores
    // private keys, so it cannot decrypt user messages.
    await User.findByIdAndUpdate(userId, { publicKey }, { new: true, runValidators: false });

    res.status(200).json({
      status: 'success',
      message: 'Public key saved',
    });
  } catch (error: unknown) {
    console.log(
      'Error in savePublicKey',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Returns a user's public key for message encryption by peers
 * @route   GET /api/users/:id/public-key
 * @access  Private
 */
export const getUserPublicKey = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const targetUserId = req.params.id;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({
        status: 'fail',
        error: 'Invalid user id',
      });
      return;
    }

    const user = await User.findById(targetUserId).select('publicKey');
    if (!user || !user.publicKey) {
      res.status(404).json({
        status: 'fail',
        error: 'Public key not found for user',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      publicKey: user.publicKey,
    });
  } catch (error: unknown) {
    console.log(
      'Error in getUserPublicKey',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      error: 'Internal server error',
    });
  }
};

/**
 * @desc    Retrieves details for selected conversation user, shared media, links and documents
 * @route   GET /api/users/:id/details
 * @access  Private
 */
export const getUserDetails = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const targetUserId = req.params.id;
    const loggedinUserId = req.user;

    if (!loggedinUserId) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({
        status: 'fail',
        message: 'Invalid user id',
      });
      return;
    }

    if (String(targetUserId) === String(loggedinUserId)) {
      res.status(400).json({
        status: 'fail',
        message: 'Cannot fetch details for current user',
      });
      return;
    }

    const user = await User.findById(targetUserId).select('_id userName profilePic');

    if (!user) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    const pairFilter = {
      $or: [
        { senderId: loggedinUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: loggedinUserId },
      ],
    };

    // Step 1: fetch each section source independently with limits tuned for UI usage.
    // This keeps response size bounded and avoids expensive full-history scans.
    const [mediaMessages, documentMessages, textMessages] = await Promise.all([
      Message.find({
        ...pairFilter,
        messageType: { $in: ['image', 'video'] },
        fileUrl: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS_PER_SECTION)
        .select('fileUrl messageType createdAt deletedForEveryone deletedFor')
        .lean(),
      Message.find({
        ...pairFilter,
        messageType: 'file',
        fileUrl: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS_PER_SECTION)
        .select('fileName fileUrl fileSize createdAt deletedForEveryone deletedFor')
        .lean(),
      Message.find({
        ...pairFilter,
        text: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_LINK_SOURCE_MESSAGES)
        .select('text createdAt deletedForEveryone deletedFor')
        .lean(),
    ]);

      // Step 2: project visible media entries in descending recency order.
    const media: UserDetailsResponse['media'] = [];
    mediaMessages.forEach((message) => {
      if (!isVisibleToUser(message, String(loggedinUserId))) return;

      const fileUrl = typeof message.fileUrl === 'string' ? message.fileUrl : '';
      const messageType = message.messageType;
      const createdAt =
        message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now());

      if (!fileUrl) return;
      if (messageType !== 'image' && messageType !== 'video') return;

      media.push({
        url: fileUrl,
        type: messageType,
        createdAt,
      });
    });

    // Step 3: project visible document entries with optional size metadata.
    const documents: UserDetailsResponse['documents'] = [];
    documentMessages.forEach((message) => {
      if (!isVisibleToUser(message, String(loggedinUserId))) return;

      const fileUrl = typeof message.fileUrl === 'string' ? message.fileUrl : '';
      if (!fileUrl) return;

      const createdAt =
        message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now());

      documents.push({
        name: message.fileName || 'Shared document',
        url: fileUrl,
        size: typeof message.fileSize === 'number' ? message.fileSize : undefined,
        createdAt,
      });
    });

    // Step 4: extract and dedupe links from visible text messages.
    const seenLinks = new Set<string>();
    const links: UserDetailsResponse['links'] = [];

    textMessages.forEach((message) => {
      if (!isVisibleToUser(message, String(loggedinUserId))) return;

      const text = typeof message.text === 'string' ? message.text : '';
      const matches = text.match(URL_REGEX) || [];
      const createdAt =
        message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now());

      matches.forEach((rawMatch) => {
        if (links.length >= MAX_ITEMS_PER_SECTION) return;

        const url = normalizeUrl(rawMatch);
        if (!url || seenLinks.has(url)) return;

        seenLinks.add(url);
        links.push({
          url,
          title: buildLinkTitle(url),
          createdAt,
        });
      });
    });

    // Step 5: return normalized details payload consumed by the right-side panel.
    res.status(200).json({
      user: {
        _id: String(user._id),
        username: user.userName,
        profilePic: user.profilePic,
        status: 'offline',
      },
      media,
      links,
      documents,
    } satisfies UserDetailsResponse);
  } catch (error: unknown) {
    console.log(
      'Error in getUserDetails',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Updates the authenticated user's display name
 * @route   PATCH /api/users/update-name
 * @access  Private
 * @param   req.body - { userName: string }
 * @returns JSON response with updated user data
 */
export const updateUserName = async (
  req: AuthenticatedRequest<unknown, unknown, UpdateUserNameDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { userName } = req.body;

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    // Validate name input
    if (!userName || userName.trim().length < 5) {
      res.status(400).json({
        status: 'fail',
        message: 'User name must be at least 5 characters',
      });
      return;
    }

    // Update user name in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { userName: userName.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in updateUserName',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Generates a signed upload token for profile picture upload to Cloudinary
 * @route   POST /api/users/upload-profile-pic-signature
 * @access  Private
 * @param   req.body - {} (empty, uses auth from middleware)
 * @returns JSON response with Cloudinary upload credentials
 */
export const getProfilePictureUploadSignature = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryCloudName || !cloudinaryApiKey) {
      res.status(500).json({
        status: 'fail',
        message: 'Cloudinary environment variables are not configured',
      });
      return;
    }

    // Initialize Cloudinary config (used by other profile picture operations)
    getCloudinary();

    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // Create unique public ID using user ID
    const publicId = `chat-app/profile-pics/${userId}`;

    // Define parameters for signature generation
    const params = {
      timestamp,
      public_id: publicId,
      folder: 'chat-app/profile-pics',
    };

    // Generate SHA-1 signature
    const paramString = Object.entries(params)
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const signature = crypto
      .createHash('sha1')
      .update(paramString + cloudinaryApiSecret)
      .digest('hex');

    res.status(200).json({
      status: 'success',
      data: {
        cloudName: cloudinaryCloudName,
        apiKey: cloudinaryApiKey,
        timestamp,
        signature,
        publicId,
        resourceType: 'image',
        maxFileSizeBytes: 5 * 1024 * 1024, // 5MB limit
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in getProfilePictureUploadSignature',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Saves uploaded profile picture URL to user document
 * @route   POST /api/users/upload-profile-pic
 * @access  Private
 * @param   req.body - { profilePicUrl: string }
 * @returns JSON response with updated user data
 */
export const saveProfilePictureUrl = async (
  req: AuthenticatedRequest<unknown, unknown, { profilePicUrl: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { profilePicUrl } = req.body;

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    // Validate profile picture URL
    if (!profilePicUrl || typeof profilePicUrl !== 'string') {
      res.status(400).json({
        status: 'fail',
        message: 'Profile picture URL is required',
      });
      return;
    }

    // Validate that URL is from Cloudinary
    const url = new URL(profilePicUrl);
    if (!url.hostname.endsWith('res.cloudinary.com')) {
      res.status(400).json({
        status: 'fail',
        message: 'Profile picture must be uploaded to Cloudinary',
      });
      return;
    }

    // Update user with new profile picture
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: profilePicUrl },
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in saveProfilePictureUrl',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Deletes the user's profile picture (reverts to default)
 * @route   DELETE /api/users/delete-profile-pic
 * @access  Private
 * @returns JSON response with updated user data
 */
export const deleteProfilePicture = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    // Fetch current user to get profile picture
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    // If picture exists in Cloudinary, delete it
    if (user.profilePic && user.profilePic.includes('res.cloudinary.com')) {
      try {
        const cloudinary = getCloudinary();
        const publicId = `chat-app/profile-pics/${userId}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        // Log error but continue with database update
        console.log(
          'Error deleting Cloudinary asset:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Remove profile picture from database
    user.profilePic = undefined;
    const updatedUser = await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in deleteProfilePicture',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};