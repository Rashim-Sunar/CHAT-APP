// ----------------------------------------
// @file   conversationController.ts
// @desc   Manages conversations (direct + group): listing, creation,
//         membership, invite links, and the unified message send/history
//         endpoints that replace the old user-id-keyed message routes.
// ----------------------------------------

import type { Response } from 'express';
import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';
import Message, { MessageDocument } from '../models/messageModel.js';
import User from '../models/userModel.js';
import { emitToUserDevices } from '../socket/socket.js';
import { recordConversationSeen } from '../Utils/readReceipt.js';
import { getSnapshot } from '../Utils/callSession.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type {
  AddMembersDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  SendConversationMessageDto,
  UpdateGroupDto,
} from '../types/dtos/conversation.js';
import {
  buildRealtimePayload,
  isCloudinaryPathValidForType,
  isCloudinaryUrl,
  isMessageDeletedForUser,
  MESSAGE_DELETED_TEXT,
} from './messageController.js';
import {
  resolveMessageTypeFromMime,
  validateFilePayload,
} from '../Utils/fileValidation.js';

// Soft cap on group size — per-message RSA-wrap cost scales linearly with
// membership, and this keeps encryption latency and payload size bounded.
const MAX_GROUP_MEMBERS = 250;
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 100;

type ConversationParticipantSummary = {
  _id: string;
  userName: string;
  gender: string;
  profilePic?: string;
  isAdmin: boolean;
  isCreator: boolean;
  addedByUserId?: string;
  addedByUserName?: string;
  // True when we have a memberMeta record for them (so we know they didn't
  // just predate this tracking) but no addedBy — the only way that happens
  // is joining via invite link, since every other join path sets addedBy.
  joinedViaInvite: boolean;
};

// Shared by listConversations and getConversationById so both API shapes
// stay in sync with how memberMeta is resolved into a display-ready summary.
const buildParticipantSummaries = (
  participants: { _id: mongoose.Types.ObjectId; userName: string; gender: string; profilePic?: string }[],
  conversation: { createdBy?: mongoose.Types.ObjectId; groupAdmins?: mongoose.Types.ObjectId[]; memberMeta?: { userId: mongoose.Types.ObjectId; addedBy?: mongoose.Types.ObjectId; joinedAt: Date }[] }
): ConversationParticipantSummary[] => {
  const admins = (conversation.groupAdmins || []).map((adminId) => String(adminId));
  const userNameById = new Map(participants.map((participant) => [String(participant._id), participant.userName]));

  return participants.map((participant) => {
    const meta = (conversation.memberMeta || []).find(
      (entry) => String(entry.userId) === String(participant._id)
    );
    const addedByUserId = meta?.addedBy ? String(meta.addedBy) : undefined;
    const isCreator = Boolean(conversation.createdBy) && String(conversation.createdBy) === String(participant._id);

    return {
      _id: String(participant._id),
      userName: participant.userName,
      gender: participant.gender,
      profilePic: participant.profilePic,
      isAdmin: admins.includes(String(participant._id)),
      isCreator,
      addedByUserId,
      // Only resolvable if the adder is still a current member — if they've
      // since left, we still show the fact someone added this member, just
      // without a name attached.
      addedByUserName: addedByUserId ? userNameById.get(addedByUserId) : undefined,
      joinedViaInvite: Boolean(meta) && !meta?.addedBy && !isCreator,
    };
  });
};

type ConversationSummary = {
  _id: string;
  type: 'direct' | 'group';
  displayName: string;
  displayAvatar?: string;
  participants: ConversationParticipantSummary[];
  groupName?: string;
  groupAvatar?: string;
  createdBy?: string;
  admins?: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount?: number;
  seenAt?: string;
  activeCall?: { callType: 'audio' | 'video'; participantCount: number };
};

const hashInviteToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const isParticipant = (conversation: ConversationDocument, userId: string): boolean =>
  conversation.participants.some((participantId) => String(participantId) === userId);

const isGroupAdmin = (conversation: ConversationDocument, userId: string): boolean =>
  Array.isArray(conversation.groupAdmins) &&
  conversation.groupAdmins.some((adminId) => String(adminId) === userId);

// Convert a message record into a sidebar-safe preview string, mirroring
// userController.ts's getSidebarPreviewText so both endpoints render
// identical placeholders for encrypted/media/deleted content.
const getPreviewText = (message: {
  messageType?: string;
  text?: string;
  encryptedMessage?: string;
  fileName?: string;
  deletedForEveryone?: boolean;
  callType?: string;
  callStatus?: string;
}): string => {
  if (message.deletedForEveryone) return MESSAGE_DELETED_TEXT;
  if (message.messageType === 'text') {
    return message.encryptedMessage ? 'Encrypted message' : (message.text || '').trim();
  }
  if (message.messageType === 'image') return 'Sent an image';
  if (message.messageType === 'video') return 'Sent a video';
  if (message.messageType === 'file') return message.fileName || 'Sent a file';
  if (message.messageType === 'call_log') {
    const callLabel = message.callType === 'video' ? 'Video call' : 'Voice call';
    if (message.callStatus === 'missed') return 'Missed call';
    if (message.callStatus === 'declined') return 'Call declined';
    return callLabel;
  }
  return '';
};

type LastMessageAggregate = {
  _id: mongoose.Types.ObjectId; // conversationId
  lastMessageType?: string;
  lastText?: string;
  lastEncryptedMessage?: string;
  lastFileName?: string;
  lastCreatedAt?: Date;
  lastSenderId?: mongoose.Types.ObjectId;
  lastDeletedForEveryone?: boolean;
  lastDeletedFor?: mongoose.Types.ObjectId[];
  lastCallType?: string;
  lastCallStatus?: string;
};

/**
 * @desc    Lists the authenticated user's conversations (direct + group),
 *          replacing the sidebar-list role of GET /api/users.
 * @route   GET /api/conversations
 * @access  Private
 */
export const listConversations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      return;
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = (await Conversation.find({ participants: userObjectId })
      .populate('participants', 'userName gender profilePic')
      .lean()) as unknown as (Omit<ConversationDocument, 'participants'> & {
      participants: { _id: mongoose.Types.ObjectId; userName: string; gender: string; profilePic?: string }[];
    })[];

    if (conversations.length === 0) {
      res.status(200).json({ status: 'success', data: { conversations: [] } });
      return;
    }

    const conversationIds = conversations.map((conversation) => conversation._id);

    // Last-message preview per conversation, grouped directly on
    // conversationId — no synthetic partner-id derivation needed now that
    // conversationId lives on every message.
    const lastMessages = await Message.aggregate<LastMessageAggregate>([
      { $match: { conversationId: { $in: conversationIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessageType: { $first: '$messageType' },
          lastText: { $first: '$text' },
          lastEncryptedMessage: { $first: '$encryptedMessage' },
          lastFileName: { $first: '$fileName' },
          lastCreatedAt: { $first: '$createdAt' },
          lastSenderId: { $first: '$senderId' },
          lastDeletedForEveryone: { $first: '$deletedForEveryone' },
          lastDeletedFor: { $first: { $ifNull: ['$deletedFor', []] } },
          lastCallType: { $first: '$callType' },
          lastCallStatus: { $first: '$callStatus' },
        },
      },
    ]);

    const lastMessageByConversationId = new Map(
      lastMessages.map((entry) => [String(entry._id), entry])
    );

    const summaries: ConversationSummary[] = conversations.map((conversation) => {
      const otherParticipants = conversation.participants.filter(
        (participant) => String(participant._id) !== userId
      );
      const isDirect = conversation.type === 'direct';
      const otherUser = isDirect ? otherParticipants[0] : undefined;

      const readState = (conversation.readBy || []).find(
        (entry) => String(entry.userId) === userId
      );
      const seenAt = readState?.seenAt ? new Date(readState.seenAt) : new Date(0);

      const lastMessage = lastMessageByConversationId.get(String(conversation._id));
      const lastMessageVisible = lastMessage
        ? !(lastMessage.lastDeletedFor || []).map((value) => String(value)).includes(userId)
        : false;

      const admins = (conversation.groupAdmins || []).map((adminId) => String(adminId));
      const callSnapshot = getSnapshot(String(conversation._id));

      return {
        _id: String(conversation._id),
        type: conversation.type,
        displayName: isDirect ? otherUser?.userName || 'Unknown user' : conversation.groupName || 'Group',
        displayAvatar: isDirect ? otherUser?.profilePic : conversation.groupAvatar,
        participants: buildParticipantSummaries(conversation.participants, conversation),
        groupName: conversation.groupName,
        groupAvatar: conversation.groupAvatar,
        createdBy: conversation.createdBy ? String(conversation.createdBy) : undefined,
        admins: conversation.type === 'group' ? admins : undefined,
        lastMessage: lastMessageVisible ? getPreviewText({
          messageType: lastMessage?.lastMessageType,
          text: lastMessage?.lastText,
          encryptedMessage: lastMessage?.lastEncryptedMessage,
          fileName: lastMessage?.lastFileName,
          deletedForEveryone: lastMessage?.lastDeletedForEveryone,
          callType: lastMessage?.lastCallType,
          callStatus: lastMessage?.lastCallStatus,
        }) : undefined,
        lastMessageAt: lastMessage?.lastCreatedAt?.toISOString(),
        lastMessageSenderId: lastMessage?.lastSenderId ? String(lastMessage.lastSenderId) : undefined,
        unreadCount: 0, // computed below
        seenAt: readState?.seenAt ? new Date(readState.seenAt).toISOString() : undefined,
        activeCall: callSnapshot
          ? { callType: callSnapshot.callType, participantCount: callSnapshot.participantCount }
          : undefined,
      };
    });

    // Unread counts: messages created after this viewer's own seenAt,
    // authored by someone else, not deleted-for-them.
    const unreadAggregate = await Message.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      {
        $match: {
          conversationId: { $in: conversationIds },
          senderId: { $ne: userObjectId },
          deletedForEveryone: { $ne: true },
          deletedFor: { $nin: [userObjectId] },
        },
      },
      { $group: { _id: '$conversationId', messages: { $push: { createdAt: '$createdAt' } } } },
    ]);

    const seenAtByConversationId = new Map(
      conversations.map((conversation) => {
        const readState = (conversation.readBy || []).find(
          (entry) => String(entry.userId) === userId
        );
        return [String(conversation._id), readState?.seenAt ? new Date(readState.seenAt) : new Date(0)];
      })
    );

    const unreadCountByConversationId = new Map<string, number>();
    unreadAggregate.forEach((entry) => {
      const conversationId = String(entry._id);
      const seenAt = seenAtByConversationId.get(conversationId) || new Date(0);
      const count = (entry as unknown as { messages: { createdAt: Date }[] }).messages.filter(
        (message) => new Date(message.createdAt).getTime() > seenAt.getTime()
      ).length;
      unreadCountByConversationId.set(conversationId, count);
    });

    const summariesWithUnread = summaries.map((summary) => ({
      ...summary,
      unreadCount: unreadCountByConversationId.get(summary._id) || 0,
    }));

    // Most recently active conversations first.
    summariesWithUnread.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    res.status(200).json({ status: 'success', data: { conversations: summariesWithUnread } });
  } catch (error: unknown) {
    console.log('Error in listConversations:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Finds or creates a 2-party direct conversation with another user.
 * @route   POST /api/conversations/direct
 * @access  Private
 */
export const createDirectConversation = async (
  req: AuthenticatedRequest<unknown, unknown, CreateDirectConversationDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { userId: otherUserId } = req.body;

    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      res.status(400).json({ status: 'fail', error: 'A valid userId is required' });
      return;
    }

    if (otherUserId === userId) {
      res.status(400).json({ status: 'fail', error: 'Cannot start a conversation with yourself' });
      return;
    }

    const otherUserExists = await User.exists({ _id: otherUserId });
    if (!otherUserExists) {
      res.status(404).json({ status: 'fail', error: 'User not found' });
      return;
    }

    let conversation = (await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, otherUserId], $size: 2 },
    })) as ConversationDocument | null;

    if (!conversation) {
      conversation = (await Conversation.create({
        type: 'direct',
        participants: [userId, otherUserId],
      })) as ConversationDocument;
    }

    res.status(200).json({ status: 'success', data: { conversationId: String(conversation._id) } });
  } catch (error: unknown) {
    console.log('Error in createDirectConversation:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Creates a new group conversation.
 * @route   POST /api/conversations
 * @access  Private
 */
export const createGroupConversation = async (
  req: AuthenticatedRequest<unknown, unknown, CreateGroupConversationDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const groupName = req.body.groupName?.trim();
    const participantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];

    if (!groupName) {
      res.status(400).json({ status: 'fail', error: 'groupName is required' });
      return;
    }

    const validParticipantIds = [...new Set(participantIds.filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== userId))];

    if (validParticipantIds.length === 0) {
      res.status(400).json({ status: 'fail', error: 'At least one other member is required' });
      return;
    }

    const totalMembers = validParticipantIds.length + 1;
    if (totalMembers > MAX_GROUP_MEMBERS) {
      res.status(400).json({ status: 'fail', error: `Groups are limited to ${MAX_GROUP_MEMBERS} members` });
      return;
    }

    const existingUsersCount = await User.countDocuments({ _id: { $in: validParticipantIds } });
    if (existingUsersCount !== validParticipantIds.length) {
      res.status(400).json({ status: 'fail', error: 'One or more members do not exist' });
      return;
    }

    const createdAt = new Date();
    const conversation = await Conversation.create({
      type: 'group',
      groupName,
      participants: [userId, ...validParticipantIds],
      groupAdmins: [userId],
      createdBy: userId,
      memberMeta: [
        { userId, joinedAt: createdAt },
        ...validParticipantIds.map((memberId) => ({ userId: memberId, addedBy: userId, joinedAt: createdAt })),
      ],
    });

    // Invited members need to learn about the new group without waiting for
    // their next reload — mirrors addGroupMembers' realtime notification.
    const payload = { conversationId: String(conversation._id), addedUserIds: validParticipantIds };
    validParticipantIds.forEach((participantId) => {
      emitToUserDevices(participantId, 'conversation:membersAdded', payload);
    });

    res.status(201).json({ status: 'success', data: { conversationId: String(conversation._id) } });
  } catch (error: unknown) {
    console.log('Error in createGroupConversation:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Retrieves full metadata for one conversation (used by the group
 *          info panel and to resolve recipient public keys client-side).
 * @route   GET /api/conversations/:id
 * @access  Private — requester must be a participant
 */
export const getConversationById = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ status: 'fail', error: 'Invalid conversation id' });
      return;
    }

    const conversation = (await Conversation.findById(id).populate(
      'participants',
      'userName gender profilePic'
    )) as unknown as
      | (Omit<ConversationDocument, 'participants'> & {
          participants: { _id: mongoose.Types.ObjectId; userName: string; gender: string; profilePic?: string }[];
        })
      | null;

    const requesterIsParticipant = Boolean(
      conversation?.participants.some((participant) => String(participant._id) === userId)
    );

    if (!conversation || !requesterIsParticipant) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    const admins = (conversation.groupAdmins || []).map((adminId) => String(adminId));

    res.status(200).json({
      status: 'success',
      data: {
        conversation: {
          _id: String(conversation._id),
          type: conversation.type,
          groupName: conversation.groupName,
          groupAvatar: conversation.groupAvatar,
          createdBy: conversation.createdBy ? String(conversation.createdBy) : undefined,
          admins: conversation.type === 'group' ? admins : undefined,
          participants: buildParticipantSummaries(conversation.participants, conversation),
        },
      },
    });
  } catch (error: unknown) {
    console.log('Error in getConversationById:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Updates group name/avatar. Admin-only, group only.
 * @route   PATCH /api/conversations/:id
 * @access  Private
 */
export const updateGroupConversation = async (
  req: AuthenticatedRequest<{ id: string }, unknown, UpdateGroupDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations can be updated' });
      return;
    }

    if (!isGroupAdmin(conversation, userId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can update the group' });
      return;
    }

    if (typeof req.body.groupName === 'string') {
      const trimmed = req.body.groupName.trim();
      if (!trimmed) {
        res.status(400).json({ status: 'fail', error: 'groupName cannot be empty' });
        return;
      }
      conversation.groupName = trimmed;
    }

    if (typeof req.body.groupAvatar === 'string') {
      conversation.groupAvatar = req.body.groupAvatar;
    }

    await conversation.save();

    conversation.participants.forEach((participantId) => {
      emitToUserDevices(String(participantId), 'conversation:updated', {
        conversationId: String(conversation._id),
        groupName: conversation.groupName,
        groupAvatar: conversation.groupAvatar,
      });
    });

    res.status(200).json({
      status: 'success',
      data: { groupName: conversation.groupName, groupAvatar: conversation.groupAvatar },
    });
  } catch (error: unknown) {
    console.log('Error in updateGroupConversation:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Adds members to a group. Admin-only.
 * @route   POST /api/conversations/:id/members
 * @access  Private
 */
export const addGroupMembers = async (
  req: AuthenticatedRequest<{ id: string }, unknown, AddMembersDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;
    const requestedUserIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations support members' });
      return;
    }

    if (!isGroupAdmin(conversation, userId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can add members' });
      return;
    }

    const existingParticipantIds = new Set(conversation.participants.map((p) => String(p)));
    const newUserIds = [...new Set(requestedUserIds)].filter(
      (candidateId) => mongoose.Types.ObjectId.isValid(candidateId) && !existingParticipantIds.has(candidateId)
    );

    if (newUserIds.length === 0) {
      res.status(400).json({ status: 'fail', error: 'No new members to add' });
      return;
    }

    if (conversation.participants.length + newUserIds.length > MAX_GROUP_MEMBERS) {
      res.status(400).json({ status: 'fail', error: `Groups are limited to ${MAX_GROUP_MEMBERS} members` });
      return;
    }

    const existingUsersCount = await User.countDocuments({ _id: { $in: newUserIds } });
    if (existingUsersCount !== newUserIds.length) {
      res.status(400).json({ status: 'fail', error: 'One or more members do not exist' });
      return;
    }

    conversation.participants.push(...newUserIds.map((newUserId) => new Types.ObjectId(newUserId)));
    const addedAt = new Date();
    conversation.memberMeta = [
      ...(conversation.memberMeta || []),
      ...newUserIds.map((newUserId) => ({
        userId: new Types.ObjectId(newUserId),
        addedBy: new Types.ObjectId(userId),
        joinedAt: addedAt,
      })),
    ];
    await conversation.save();

    const payload = { conversationId: String(conversation._id), addedUserIds: newUserIds };
    conversation.participants.forEach((participantId) => {
      emitToUserDevices(String(participantId), 'conversation:membersAdded', payload);
    });

    res.status(200).json({ status: 'success', data: { addedUserIds: newUserIds } });
  } catch (error: unknown) {
    console.log('Error in addGroupMembers:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

// Shared removal logic for both admin-removes-someone-else and self-leave,
// since both need the same last-admin guard.
const removeMember = async (
  conversation: ConversationDocument,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
  const remainingAdmins = (conversation.groupAdmins || [])
    .map((adminId) => String(adminId))
    .filter((adminId) => adminId !== targetUserId);
  const targetIsAdmin = (conversation.groupAdmins || []).some((adminId) => String(adminId) === targetUserId);
  const remainingParticipants = conversation.participants
    .map((participantId) => String(participantId))
    .filter((participantId) => participantId !== targetUserId);

  if (targetIsAdmin && remainingAdmins.length === 0 && remainingParticipants.length > 0) {
    return {
      ok: false,
      status: 400,
      error: 'You are the last admin — promote another member to admin before leaving',
    };
  }

  conversation.participants = remainingParticipants.map((id) => new Types.ObjectId(id));
  conversation.groupAdmins = remainingAdmins.map((id) => new Types.ObjectId(id));
  await conversation.save();
  return { ok: true };
};

/**
 * @desc    Removes another member from a group. Admin-only.
 * @route   DELETE /api/conversations/:id/members/:userId
 * @access  Private
 */
export const removeGroupMember = async (
  req: AuthenticatedRequest<{ id: string; userId: string }>,
  res: Response
): Promise<void> => {
  try {
    const requesterId = String(req.user);
    const { id, userId: targetUserId } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations support members' });
      return;
    }

    if (!isGroupAdmin(conversation, requesterId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can remove members' });
      return;
    }

    if (!isParticipant(conversation, targetUserId)) {
      res.status(404).json({ status: 'fail', error: 'User is not a member of this group' });
      return;
    }

    const previousParticipants = conversation.participants.map((participantId) => String(participantId));
    const result = await removeMember(conversation, targetUserId);
    if (!result.ok) {
      res.status(result.status).json({ status: 'fail', error: result.error });
      return;
    }

    const payload = { conversationId: String(conversation._id), removedUserId: targetUserId };
    previousParticipants.forEach((participantId) => {
      emitToUserDevices(participantId, 'conversation:memberRemoved', payload);
    });

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in removeGroupMember:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Leaves a group (self-removal). Not admin-gated.
 * @route   DELETE /api/conversations/:id/members/me
 * @access  Private
 */
export const leaveGroupConversation = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations can be left' });
      return;
    }

    if (!isParticipant(conversation, userId)) {
      res.status(404).json({ status: 'fail', error: 'You are not a member of this group' });
      return;
    }

    const previousParticipants = conversation.participants.map((participantId) => String(participantId));
    const result = await removeMember(conversation, userId);
    if (!result.ok) {
      res.status(result.status).json({ status: 'fail', error: result.error });
      return;
    }

    const payload = { conversationId: String(conversation._id), removedUserId: userId };
    previousParticipants.forEach((participantId) => {
      emitToUserDevices(participantId, 'conversation:memberRemoved', payload);
    });

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in leaveGroupConversation:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Promotes a member to admin. Admin-only — gives the last admin a
 *          way to hand off before leaving.
 * @route   POST /api/conversations/:id/admins/:userId
 * @access  Private
 */
export const promoteGroupAdmin = async (
  req: AuthenticatedRequest<{ id: string; userId: string }>,
  res: Response
): Promise<void> => {
  try {
    const requesterId = String(req.user);
    const { id, userId: targetUserId } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations have admins' });
      return;
    }

    if (!isGroupAdmin(conversation, requesterId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can promote members' });
      return;
    }

    if (!isParticipant(conversation, targetUserId)) {
      res.status(404).json({ status: 'fail', error: 'User is not a member of this group' });
      return;
    }

    if (!isGroupAdmin(conversation, targetUserId)) {
      conversation.groupAdmins = [...(conversation.groupAdmins || []), new Types.ObjectId(targetUserId)];
      await conversation.save();
    }

    const payload = { conversationId: String(conversation._id), newAdminUserId: targetUserId };
    conversation.participants.forEach((participantId) => {
      emitToUserDevices(String(participantId), 'conversation:adminPromoted', payload);
    });

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in promoteGroupAdmin:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Generates/rotates a group's invite link. Admin-only. Returns the
 *          plaintext token once; only its hash is persisted.
 * @route   POST /api/conversations/:id/invite
 * @access  Private
 */
export const createInviteLink = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (conversation.type !== 'group') {
      res.status(400).json({ status: 'fail', error: 'Only group conversations support invite links' });
      return;
    }

    if (!isGroupAdmin(conversation, userId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can generate an invite link' });
      return;
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    conversation.inviteTokenHash = hashInviteToken(token);
    conversation.inviteTokenExpiresAt = expiresAt;
    await conversation.save();

    const clientUrl = (process.env.CLIENT_URL || '').replace(/\/$/, '');
    const inviteUrl = `${clientUrl}/join/${token}`;

    res.status(200).json({
      status: 'success',
      data: { inviteUrl, token, expiresAt: expiresAt.toISOString() },
    });
  } catch (error: unknown) {
    console.log('Error in createInviteLink:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Revokes a group's invite link without generating a new one.
 * @route   DELETE /api/conversations/:id/invite
 * @access  Private
 */
export const revokeInviteLink = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    if (!isGroupAdmin(conversation, userId)) {
      res.status(403).json({ status: 'fail', error: 'Only group admins can revoke the invite link' });
      return;
    }

    conversation.inviteTokenHash = undefined;
    conversation.inviteTokenExpiresAt = null;
    await conversation.save();

    res.status(200).json({ status: 'success' });
  } catch (error: unknown) {
    console.log('Error in revokeInviteLink:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

const findConversationByInviteToken = async (token: string): Promise<ConversationDocument | null> => {
  const tokenHash = hashInviteToken(token);
  const conversation = (await Conversation.findOne({
    inviteTokenHash: tokenHash,
    inviteTokenExpiresAt: { $gt: new Date() },
  })) as ConversationDocument | null;

  return conversation;
};

/**
 * @desc    Preview a group before joining via invite link (no membership change).
 * @route   GET /api/conversations/join/:token/preview
 * @access  Private
 */
export const previewInviteLink = async (
  req: AuthenticatedRequest<{ token: string }>,
  res: Response
): Promise<void> => {
  try {
    const conversation = await findConversationByInviteToken(req.params.token);
    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'This invite link is invalid or has expired' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        groupName: conversation.groupName,
        groupAvatar: conversation.groupAvatar,
        memberCount: conversation.participants.length,
      },
    });
  } catch (error: unknown) {
    console.log('Error in previewInviteLink:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Joins a group via invite link. Idempotent — returns the
 *          conversation without error if already a member.
 * @route   POST /api/conversations/join/:token
 * @access  Private
 */
export const joinConversationByInviteLink = async (
  req: AuthenticatedRequest<{ token: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const conversation = await findConversationByInviteToken(req.params.token);

    if (!conversation) {
      res.status(404).json({ status: 'fail', error: 'This invite link is invalid or has expired' });
      return;
    }

    const alreadyMember = isParticipant(conversation, userId);
    if (!alreadyMember) {
      if (conversation.participants.length >= MAX_GROUP_MEMBERS) {
        res.status(400).json({ status: 'fail', error: `Groups are limited to ${MAX_GROUP_MEMBERS} members` });
        return;
      }

      conversation.participants.push(new Types.ObjectId(userId));
      // No addedBy — they joined themselves via the invite link, not via an admin.
      conversation.memberMeta = [
        ...(conversation.memberMeta || []),
        { userId: new Types.ObjectId(userId), joinedAt: new Date() },
      ];
      await conversation.save();

      const payload = { conversationId: String(conversation._id), addedUserIds: [userId] };
      conversation.participants.forEach((participantId) => {
        emitToUserDevices(String(participantId), 'conversation:membersAdded', payload);
      });
    }

    res.status(200).json({ status: 'success', data: { conversationId: String(conversation._id) } });
  } catch (error: unknown) {
    console.log('Error in joinConversationByInviteLink:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Cursor-paginated message history for one conversation, replacing
 *          the old unbounded GET /messages/:id.
 * @route   GET /api/conversations/:id/messages?before=<messageId>&limit=50
 * @access  Private — requester must be a participant
 */
export const getConversationMessages = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const requestedLimit = Number(req.query.limit) || DEFAULT_MESSAGE_PAGE_SIZE;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_MESSAGE_PAGE_SIZE);

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation || !isParticipant(conversation, userId)) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    // Only the first page (no `before` cursor) represents "caught up to the
    // latest" — paging further back into history shouldn't mark anything seen.
    if (!before) {
      const receipt = await recordConversationSeen(String(conversation._id), userId);
      if (receipt) {
        receipt.recipientIds.forEach((recipientId) => {
          emitToUserDevices(recipientId, 'conversation:seen', receipt);
        });
      }
    }

    const query: Record<string, unknown> = { conversationId: conversation._id };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      const beforeMessage = await Message.findById(before).select('createdAt');
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    // Fetch one extra to know whether more history remains.
    const rawMessages = (await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)) as MessageDocument[];

    const hasMore = rawMessages.length > limit;
    const pageMessages = rawMessages.slice(0, limit).reverse();

    const messages = pageMessages
      .filter((messageDoc) => !isMessageDeletedForUser(messageDoc, userId))
      .map((messageDoc) => {
        const messageWithTimestamps = messageDoc as MessageDocument & { createdAt: Date; updatedAt: Date };
        return buildRealtimePayload(messageWithTimestamps, String(conversation._id));
      });

    res.status(200).json({ status: 'success', data: { messages, hasMore } });
  } catch (error: unknown) {
    console.log('Error in getConversationMessages:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * @desc    Unified send for direct + group conversations, replacing
 *          POST /messages/send/:id. The message content is encrypted once;
 *          encryptedAESKeys must cover exactly the conversation's current
 *          participants (rejected otherwise) — a real E2EE integrity check
 *          that stops a buggy client from persisting a message some
 *          participants could never decrypt.
 * @route   POST /api/conversations/:id/messages
 * @access  Private — requester must be a participant
 */
export const sendConversationMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, SendConversationMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;
    const body = req.body;

    const conversation = (await Conversation.findById(id)) as ConversationDocument | null;
    if (!conversation || !isParticipant(conversation, userId)) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    const messageType = body.messageType || 'text';
    const participantIds = conversation.participants.map((participantId) => String(participantId));

    if (messageType === 'text') {
      if (!body.encryptedMessage || !body.iv || !Array.isArray(body.encryptedAESKeys) || body.encryptedAESKeys.length === 0) {
        res.status(400).json({ status: 'fail', error: 'Encrypted text payload is incomplete' });
        return;
      }

      const wrappedForUserIds = new Set(body.encryptedAESKeys.map((entry) => entry.userId));
      const missingRecipients = participantIds.filter((participantId) => !wrappedForUserIds.has(participantId));
      if (missingRecipients.length > 0) {
        res.status(400).json({
          status: 'fail',
          error: 'encryptedAESKeys must include every current conversation participant',
        });
        return;
      }
    } else {
      if (!body.fileUrl || !body.fileName || !body.mimeType || !body.fileSize) {
        res.status(400).json({ status: 'fail', error: 'Media messages must include file metadata' });
        return;
      }

      const fileValidation = validateFilePayload(body.fileName, body.mimeType, Number(body.fileSize));
      if (!fileValidation.valid) {
        res.status(400).json({ status: 'fail', error: fileValidation.reason });
        return;
      }

      const resolvedType = resolveMessageTypeFromMime(body.mimeType);
      if (!resolvedType || resolvedType !== messageType) {
        res.status(400).json({ status: 'fail', error: 'messageType does not match mimeType' });
        return;
      }

      if (!isCloudinaryUrl(body.fileUrl) || !isCloudinaryPathValidForType(body.fileUrl, messageType)) {
        res.status(400).json({ status: 'fail', error: 'Invalid file URL' });
        return;
      }
    }

    // A reply must reference a message in this same conversation.
    let validatedReplyTo: string | undefined;
    if (body.replyTo) {
      const referencedMessage = await Message.findOne({
        _id: body.replyTo,
        conversationId: conversation._id,
      }).select('_id');
      if (referencedMessage) {
        validatedReplyTo = String(referencedMessage._id);
      }
    }

    const isDirect = conversation.type === 'direct';
    const otherParticipantId = isDirect
      ? participantIds.find((participantId) => participantId !== userId)
      : undefined;

    const newMessage = new Message({
      senderId: userId,
      receiverId: isDirect ? otherParticipantId : undefined,
      conversationId: conversation._id,
      messageType,
      text: messageType === 'text' ? '' : undefined,
      encryptedMessage: body.encryptedMessage,
      encryptedAESKeys: body.encryptedAESKeys,
      iv: body.iv,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      publicId: body.publicId,
      replyTo: validatedReplyTo,
      forwarded: Boolean(body.forwarded),
    });

    conversation.messages.push(newMessage._id);
    await Promise.all([newMessage.save(), conversation.save()]);

    const messageWithTimestamps = newMessage as unknown as MessageDocument & { createdAt: Date; updatedAt: Date };
    const realtimeMessagePayload = buildRealtimePayload(messageWithTimestamps, String(conversation._id));

    conversation.participants.forEach((participantId) => {
      emitToUserDevices(String(participantId), 'newMessage', realtimeMessagePayload);
    });

    res.status(201).json({ newMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    console.log('Error in sendConversationMessage:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};
