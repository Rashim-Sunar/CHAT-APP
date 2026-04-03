export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

// Keep allow-lists explicit to minimize accidental acceptance of risky formats.
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

// Maps browser MIME types to message rendering categories used in chat UI.
export const resolveMessageTypeFromMime = (mimeType) => {
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (FILE_MIME_TYPES.has(mimeType)) return "file";
  return null;
};

// Client-side pre-validation for fast feedback before requesting signatures.
// Server still re-validates as the source of truth.
export const validateFileForUpload = (file, maxFileSizeBytes = MAX_UPLOAD_SIZE_BYTES) => {
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
