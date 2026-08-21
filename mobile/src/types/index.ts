// Phase-1 subset of frontend/src/types/index.ts — direct 1:1 text messaging
// only. Extend as later phases (groups, media, calls) get ported.

export type Gender = "male" | "female" | "others";
export type MessageType = "text";
export type StoryType = "image" | "video" | "text";
export type StoryPrivacy = "everyone" | "close_friends";

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
  isMuted?: boolean;
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
  pinned?: boolean;
  pinnedAt?: string;
  createdAt: string;
  updatedAt?: string;
  __isOptimistic?: boolean;
}

export interface SharedContentResponse {
  media: { url: string; type: "image" | "video"; createdAt: string }[];
  links: { url: string; title: string; createdAt: string }[];
  documents: { name: string; url: string; size?: number; createdAt: string }[];
}

export interface StoryUser {
  _id: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
}

export interface StoryItem {
  _id: string;
  userId: string;
  user: StoryUser;
  type: StoryType;
  mediaUrl?: string | null;
  publicId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  caption?: string;
  text?: string;
  textAlign?: "left" | "center" | "right";
  background?: string;
  privacy: StoryPrivacy;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  viewedByMe: boolean;
  isOwn: boolean;
}

export interface StoryGroup {
  user: StoryUser;
  stories: StoryItem[];
  hasUnseenStory: boolean;
  latestStoryAt: string;
}

export interface StoriesResponse {
  status: string;
  data?: {
    stories: StoryGroup[];
  };
}

export interface StoryCreatePayload {
  type: StoryType;
  caption?: string;
  text?: string;
  textAlign?: "left" | "center" | "right";
  background?: string;
  privacy?: StoryPrivacy;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
}

export interface StoryUploadSignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  resourceType: "image" | "video";
  accessMode?: string;
  maxFileSizeBytes?: number;
}

export interface ServerToClientEvents {
  getOnlineUsers: (users: string[]) => void;
  newMessage: (message: Message) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string; seenAt: string }) => void;
  "conversation:muted": (payload: { conversationId: string; muted: boolean }) => void;
  "conversation:blocked": (payload: { conversationId: string; blocked: boolean; blockedByMe: boolean }) => void;
  "story:created": (payload: { storyId: string; userId: string }) => void;
  "story:viewed": (payload: { storyId: string; viewerId: string }) => void;
  "story:deleted": (payload: { storyId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  connect_error: (error: Error) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string }) => void;
  "story:viewed": (payload: { storyId: string }) => void;
}
