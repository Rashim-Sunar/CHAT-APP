import path from 'path';

// Default hard stop for uploads when env is missing/invalid.
export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

// MIME allow-lists are intentionally explicit to minimize attack surface.
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);

export type MessageType = 'text' | 'image' | 'video' | 'file';
export type CloudinaryResourceType = 'image' | 'video' | 'raw';

// Extension allow-list complements MIME checks and blocks disguised payloads.
const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
]);

// Reads upload limit from env with safe fallback to prevent unbounded uploads.
export const getMaxUploadSizeBytes = (): number => {
  const configuredLimit = Number(process.env.MAX_UPLOAD_SIZE_BYTES);

  if (!Number.isFinite(configuredLimit) || configuredLimit <= 0) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  return configuredLimit;
};

// Normalizes user-provided names to keep storage paths/logs predictable and safe.
export const sanitizeFileName = (fileName: string): string => {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
};

// Extension check is case-insensitive and resilient to empty file names.
const isAllowedExtension = (fileName: string): boolean => {
  const extension = path.extname(fileName || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
};

// Maps MIME type to application-level message type used by chat rendering logic.
export const resolveMessageTypeFromMime = (mimeType: string): MessageType | null => {
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
  if (FILE_MIME_TYPES.has(mimeType)) return 'file';
  return null;
};

// Cloudinary requires "raw" for non-image/video documents.
export const resolveCloudinaryResourceType = (mimeType: string): CloudinaryResourceType | null => {
  const messageType = resolveMessageTypeFromMime(mimeType);

  if (messageType === 'image') return 'image';
  if (messageType === 'video') return 'video';
  if (messageType === 'file') return 'raw';

  return null;
};

// Validation order is optimized for quick rejection: metadata -> size -> type -> extension.
// Both MIME and extension must pass to reduce spoofing risk.
export const validateFilePayload = (
  fileName: string,
  mimeType: string,
  fileSize: number
): { valid: true } | { valid: false; reason: string } => {
  if (!fileName || !mimeType || !Number.isFinite(fileSize)) {
    return { valid: false, reason: 'Missing required file metadata' };
  }

  if (fileSize <= 0) {
    return { valid: false, reason: 'File is empty' };
  }

  if (fileSize > getMaxUploadSizeBytes()) {
    return { valid: false, reason: 'File exceeds allowed upload size' };
  }

  if (!resolveMessageTypeFromMime(mimeType)) {
    return { valid: false, reason: 'Unsupported file type' };
  }

  if (!isAllowedExtension(fileName)) {
    return { valid: false, reason: 'Unsupported file extension' };
  }

  return { valid: true };
};
