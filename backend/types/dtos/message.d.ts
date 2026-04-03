// ----------------------------------------
// @file   message.d.ts
// @desc   Defines DTOs for message-related operations
// ----------------------------------------

export type MessageType = 'text' | 'image' | 'video' | 'file';

/**
 * @desc    Data required to send either a text or media message
 */
export interface SendMessageDto {
  messageType?: MessageType;
  message?: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

/**
 * @desc    Metadata required to request a signed Cloudinary upload
 */
export interface CreateUploadSignatureDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
}