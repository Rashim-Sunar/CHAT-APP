// ----------------------------------------
// @file   conversationRouter.ts
// @desc   Defines conversation routes (direct + group): listing, creation,
//         membership, invite links, and unified message send/history.
// ----------------------------------------

import express from 'express';
import { messageLimiter } from '../middlewares/rateLimiter.js';
import {
  listConversations,
  createDirectConversation,
  createGroupConversation,
  getConversationById,
  updateGroupConversation,
  addGroupMembers,
  removeGroupMember,
  leaveGroupConversation,
  promoteGroupAdmin,
  createInviteLink,
  revokeInviteLink,
  previewInviteLink,
  joinConversationByInviteLink,
  getConversationMessages,
  sendConversationMessage,
  muteConversation,
  unmuteConversation,
  blockUser,
  unblockUser,
  getPinnedMessages,
  getSharedContent,
} from '../controllers/conversationController.js';
import { getActiveCall } from '../controllers/callController.js';

const router = express.Router();

// ----------------------------------------
// @desc    Lists the authenticated user's conversations (direct + group)
// @route   GET /api/conversations
// @access  Private
// ----------------------------------------
router.get('/', listConversations);

// ----------------------------------------
// @desc    Finds or creates a 2-party direct conversation
// @route   POST /api/conversations/direct
// @access  Private
// ----------------------------------------
router.post('/direct', createDirectConversation);

// ----------------------------------------
// @desc    Creates a new group conversation
// @route   POST /api/conversations
// @access  Private
// ----------------------------------------
router.post('/', createGroupConversation);

// Invite-link routes are placed before the generic '/:id' routes so
// 'join' isn't matched as a conversation id.
router.get('/join/:token/preview', previewInviteLink);
router.post('/join/:token', joinConversationByInviteLink);

// ----------------------------------------
// @desc    Full conversation metadata (group info panel, key resolution)
// @route   GET /api/conversations/:id
// @access  Private
// ----------------------------------------
router.get('/:id', getConversationById);

// ----------------------------------------
// @desc    Updates group name/avatar — admin-only
// @route   PATCH /api/conversations/:id
// @access  Private
// ----------------------------------------
router.patch('/:id', updateGroupConversation);

// ----------------------------------------
// @desc    Adds members to a group — admin-only
// @route   POST /api/conversations/:id/members
// @access  Private
// ----------------------------------------
router.post('/:id/members', addGroupMembers);

// ----------------------------------------
// @desc    Removes another member — admin-only
// @route   DELETE /api/conversations/:id/members/:userId
// @access  Private
// ----------------------------------------
router.delete('/:id/members/me', leaveGroupConversation);
router.delete('/:id/members/:userId', removeGroupMember);

// ----------------------------------------
// @desc    Promotes a member to admin — admin-only
// @route   POST /api/conversations/:id/admins/:userId
// @access  Private
// ----------------------------------------
router.post('/:id/admins/:userId', promoteGroupAdmin);

// ----------------------------------------
// @desc    Generates/rotates or revokes the group's invite link — admin-only
// @route   POST/DELETE /api/conversations/:id/invite
// @access  Private
// ----------------------------------------
router.post('/:id/invite', createInviteLink);
router.delete('/:id/invite', revokeInviteLink);

// ----------------------------------------
// @desc    Cursor-paginated message history
// @route   GET /api/conversations/:id/messages
// @access  Private
// ----------------------------------------
router.get('/:id/messages', getConversationMessages);

// ----------------------------------------
// @desc    Live call session sync (reload mid-call, or a call starting in
//          a conversation that isn't currently open)
// @route   GET /api/conversations/:id/call
// @access  Private
// ----------------------------------------
router.get('/:id/call', getActiveCall);

// ----------------------------------------
// @desc    Unified send for direct + group conversations
// @route   POST /api/conversations/:id/messages
// @access  Private
// ----------------------------------------
router.post('/:id/messages', messageLimiter, sendConversationMessage);

// ----------------------------------------
// @desc    Mutes/unmutes notifications for the requester — direct + group
// @route   POST/DELETE /api/conversations/:id/mute
// @access  Private
// ----------------------------------------
router.post('/:id/mute', muteConversation);
router.delete('/:id/mute', unmuteConversation);

// ----------------------------------------
// @desc    Blocks/unblocks the other participant — direct only
// @route   POST/DELETE /api/conversations/:id/block
// @access  Private
// ----------------------------------------
router.post('/:id/block', blockUser);
router.delete('/:id/block', unblockUser);

// ----------------------------------------
// @desc    Currently-pinned messages, newest pin first
// @route   GET /api/conversations/:id/pinned-messages
// @access  Private
// ----------------------------------------
router.get('/:id/pinned-messages', getPinnedMessages);

// ----------------------------------------
// @desc    Shared media/links/documents — direct + group
// @route   GET /api/conversations/:id/shared-content
// @access  Private
// ----------------------------------------
router.get('/:id/shared-content', getSharedContent);

export default router;
