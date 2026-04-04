import type { FileValidationResult, MessageType, ResourceType } from "../types";

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
]);

export const resolveMessageTypeFromMime = (mimeType?: string | null): MessageType | null => {
  if (!mimeType) return null;
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (FILE_MIME_TYPES.has(mimeType)) return "file";
  return null;
};

export const resolveCloudinaryResourceType = (mimeType?: string | null): ResourceType | null => {
  const messageType = resolveMessageTypeFromMime(mimeType);

  if (messageType === "image") return "image";
  if (messageType === "video") return "video";
  if (messageType === "file") return "raw";

  return null;
};

export const validateFileForUpload = (
  file: File | null | undefined,
  maxFileSizeBytes: number = MAX_UPLOAD_SIZE_BYTES
): FileValidationResult => {
  if (!file) {
    return { valid: false, reason: "No file selected" };
  }

  if (!resolveMessageTypeFromMime(file.type)) {
    return { valid: false, reason: "Unsupported file type" };
  }

  if (file.size <= 0) {
    return { valid: false, reason: "File is empty" };
  }

  if (file.size > maxFileSizeBytes) {
    return { valid: false, reason: "File exceeds upload limit" };
  }

  return { valid: true };
};