import type { Message } from "../types";

export const DELETED_MESSAGE_TEXT = "This message was deleted";

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
  if (!currentUserId) return false;
  if (message.deletedForEveryone) return false;

  return Boolean(message.deletedFor?.includes(currentUserId));
};

export const isMessageEdited = (message: Message): boolean => Boolean(message.edited && !message.deletedForEveryone);
