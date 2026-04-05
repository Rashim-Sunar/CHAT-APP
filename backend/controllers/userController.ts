// ----------------------------------------
// @file   userController.ts
// @desc   Handles user-related operations (e.g., fetching users for sidebar)
// ----------------------------------------

import type { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Message from '../models/messageModel.js';
import type { AuthenticatedRequest } from '../types/express/index.js';

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

const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim().replace(/[),.;!?]+$/g, '');
  return trimmed;
};

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

    // Fetch all users excluding the current logged-in user
    const filteredUsers = await User.find({ _id: { $ne: loggedinUserId } });

    res.status(200).json({
      status: 'success',
      users: filteredUsers.length,
      data: {
        users: filteredUsers,
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

    const [mediaMessages, documentMessages, textMessages] = await Promise.all([
      Message.find({
        ...pairFilter,
        messageType: { $in: ['image', 'video'] },
        fileUrl: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS_PER_SECTION)
        .select('fileUrl messageType createdAt')
        .lean(),
      Message.find({
        ...pairFilter,
        messageType: 'file',
        fileUrl: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS_PER_SECTION)
        .select('fileName fileUrl fileSize createdAt')
        .lean(),
      Message.find({
        ...pairFilter,
        text: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_LINK_SOURCE_MESSAGES)
        .select('text createdAt')
        .lean(),
    ]);

    const media: UserDetailsResponse['media'] = [];
    mediaMessages.forEach((message) => {
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

    const documents: UserDetailsResponse['documents'] = [];
    documentMessages.forEach((message) => {
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

    const seenLinks = new Set<string>();
    const links: UserDetailsResponse['links'] = [];

    textMessages.forEach((message) => {
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