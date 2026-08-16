// Phase-1 subset of frontend/src/types/index.ts — direct 1:1 text messaging
// only. Extend as later phases (groups, media, calls) get ported.

export type Gender = "male" | "female" | "others";
export type MessageType = "text";

export interface User {
  _id: string;
  email: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
  publicKey?: JsonWebKey | null;
}

export interface AuthPayload {
  user: User;
}

export interface AuthResponse {
  status: "success" | "fail";
  message?: string;
  data?: AuthPayload;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  status?: "fail" | "error";
}

export type ConversationType = "direct" | "group";

export interface ConversationParticipant {
  _id: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  displayName: string;
  displayAvatar?: string;
  participants: ConversationParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount?: number;
  seenAt?: string;
  isBlocked?: boolean;
  blockedByMe?: boolean;
}

export interface EncryptedAesKeyEntry {
  userId: string;
  wrappedKey: string;
}

export interface Message {
  _id?: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string | null;
  messageType: MessageType;
  text?: string;
  message?: string;
  encryptedMessage?: string;
  // Legacy single-string dual-wrap envelope, decrypt-side fallback only.
  encryptedAESKey?: string;
  encryptedAESKeys?: EncryptedAesKeyEntry[];
  iv?: string;
  decryptionFailed?: boolean;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  createdAt: string;
  updatedAt?: string;
  __isOptimistic?: boolean;
}

export interface ServerToClientEvents {
  getOnlineUsers: (users: string[]) => void;
  newMessage: (message: Message) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string; seenAt: string }) => void;
}

export interface ClientToServerEvents {
  connect_error: (error: Error) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string }) => void;
}
