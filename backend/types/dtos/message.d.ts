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
  publicId?: string;
}

/**
 * @desc    Metadata required to request a signed Cloudinary upload
 */
export interface CreateUploadSignatureDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * @desc    Data required to generate a signed Cloudinary delivery URL
 *          for assets that cannot be accessed through the plain public CDN URL.
 */
export interface CreateFileDeliveryUrlDto {
  publicId: string;
  fileName: string;
  messageType?: MessageType;
  attachment?: boolean;
}