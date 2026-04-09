import type { Message } from "../types";

export const DELETED_MESSAGE_TEXT = "This message was deleted";

// Keep message rendering consistent across list items, previews, and deleted states.
export const getMessageBodyText = (message: Message): string => {
  if (message.deletedForEveryone) {
    return DELETED_MESSAGE_TEXT;
  }

  if (message.messageType === "image") return "Photo";
  if (message.messageType === "video") return "Video";
  if (message.messageType === "file") return message.fileName || "File";

  return message.text || message.message || "";
};

export const getMessagePreviewText = (message: Message): string => {
  if (message.deletedForEveryone) {
    return DELETED_MESSAGE_TEXT;
  }

  if (message.messageType === "image") return "Photo";
  if (message.messageType === "video") return "Video";
  if (message.messageType === "file") return message.fileName || "File";

  return message.text || message.message || "";
};

export const shouldHideMessageForUser = (message: Message, currentUserId?: string | null): boolean => {
  // Only hide locally deleted messages when we have a current user to compare against.
  if (!currentUserId) return false;
  if (message.deletedForEveryone) return false;

  return Boolean(message.deletedFor?.includes(currentUserId));
};

// Edited badges should never appear for messages that are no longer visible to everyone.
export const isMessageEdited = (message: Message): boolean => Boolean(message.edited && !message.deletedForEveryone);
