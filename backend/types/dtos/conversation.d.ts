// ----------------------------------------
// @file   conversation.d.ts
// @desc   Defines DTOs for conversation-related operations (direct + group)
// ----------------------------------------

import type { EncryptedAesKeyEntryDto, MessageType } from './message.js';

/**
 * @desc    Data required to find-or-create a 2-party direct conversation.
 */
export interface CreateDirectConversationDto {
  userId: string;
}

/**
 * @desc    Data required to create a new group conversation.
 */
export interface CreateGroupConversationDto {
  groupName: string;
  participantIds: string[];
}

/**
 * @desc    Data required to update group metadata.
 */
export interface UpdateGroupDto {
  groupName?: string;
  groupAvatar?: string;
}

/**
 * @desc    Data required to add members to a group.
 */
export interface AddMembersDto {
  userIds: string[];
}

/**
 * @desc    Unified send payload for both direct and group conversations —
 *          the message content is encrypted once, but the AES key is
 *          RSA-wrapped once per current recipient (2 for direct, N for group).
 */
export interface SendConversationMessageDto {
  messageType?: MessageType;
  text?: string;
  encryptedMessage?: string;
  encryptedAESKeys?: EncryptedAesKeyEntryDto[];
  iv?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  replyTo?: string;
  forwarded?: boolean;
}
