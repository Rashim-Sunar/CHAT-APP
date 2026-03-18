// ----------------------------------------
// @file   message.d.ts
// @desc   Defines DTOs for message-related operations
// ----------------------------------------

/**
 * @desc    Data required to send a message
 */
export interface SendMessageDto {
  message: string; // Message content to be sent
}