import { apiFetch } from "./client";
import type { Message } from "../types";

interface MessageMutationResponse {
  error?: string;
  updatedMessage?: Message;
}

export interface EditMessagePayload {
  content?: string;
  encryptedMessage?: string;
  encryptedAESKeys?: { userId: string; wrappedKey: string }[];
  iv?: string;
}

const unwrap = (response: MessageMutationResponse, fallback: string): Message | undefined => {
  if (response.error) throw new Error(response.error || fallback);
  return response.updatedMessage;
};

export const editMessage = async (
  messageId: string,
  payload: EditMessagePayload
): Promise<Message | undefined> => {
  const response = await apiFetch<MessageMutationResponse>(`/messages/${messageId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap(response, "Failed to edit message");
};

export const deleteMessage = async (
  messageId: string,
  type: "me" | "everyone"
): Promise<Message | undefined> => {
  const response = await apiFetch<MessageMutationResponse>(`/messages/${messageId}`, {
    method: "DELETE",
    body: JSON.stringify({ type }),
  });
  return unwrap(response, "Failed to delete message");
};

export const reactToMessage = async (messageId: string, emoji: string): Promise<Message | undefined> => {
  const response = await apiFetch<MessageMutationResponse>(`/messages/${messageId}/react`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  return unwrap(response, "Failed to react to message");
};

export const setMessagePinned = async (
  messageId: string,
  pinned: boolean
): Promise<Message | undefined> => {
  const response = await apiFetch<MessageMutationResponse>(`/messages/${messageId}/pin`, {
    method: pinned ? "POST" : "DELETE",
  });
  return unwrap(response, "Failed to update pin");
};
