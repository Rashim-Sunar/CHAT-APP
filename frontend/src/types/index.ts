import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

export type Gender = "male" | "female" | "others";
export type MessageType = "text" | "image" | "video" | "file";
export type ResourceType = "image" | "video" | "raw";

export interface User {
  _id: string;
  email: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface Conversation {
  _id: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount?: number;
  seenAt?: string;
  __isPlaceholder?: boolean;
}

export interface Message {
  _id?: string;
  conversationId?: string;
  senderId: string;
  receiverId: string;
  messageType: MessageType;
  text?: string;
  message?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  publicId?: string | null;
  edited?: boolean;
  editedAt?: string;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  createdAt: string;
  updatedAt?: string;
  __isOptimistic?: boolean;
}

export interface UploadJob {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "failed";
  error?: string | null;
}

export interface UploadSignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  resourceType: ResourceType;
  accessMode?: string;
  maxFileSizeBytes?: number;
}

export interface FileDeliveryResponse {
  signedUrl: string;
}

export interface ServerToClientEvents {
  getOnlineUsers: (users: string[]) => void;
  newMessage: (message: Message) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string; seenAt: string }) => void;
  "message:edit": (message: Message) => void;
  "message:delete": (message: Message) => void;
}

export interface ClientToServerEvents {
  connect_error: (error: Error) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketContextValue {
  socket: AppSocket | null;
  onlineUsers: string[];
}

export interface AuthContextValue {
  authUser: AuthResponse | null;
  setAuthUser: Dispatch<SetStateAction<AuthResponse | null>>;
}

export interface ConversationState {
  selectedConversation: Conversation | null;
  activeChat: Conversation | null;
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  unreadByConversation: Record<string, number>;
  uploadQueue: UploadJob[];
  detailsRefreshVersion: number;
  setSelectedConversation: (
    selectedConversation: Conversation | null,
    currentUserId?: string
  ) => void;
  setConversations: (conversations: Conversation[]) => void;
  setMessagesForConversation: (conversationKey: string, messages: Message[]) => void;
  appendMessageToConversation: (conversationKey: string, newMessage: Message) => void;
  updateMessageInConversation: (
    conversationKey: string,
    messageId: string,
    patch: Partial<Message>
  ) => void;
  removeMessageFromConversation: (conversationKey: string, messageId: string) => void;
  syncConversationPreview: (conversationKey: string, currentUserId: string) => void;
  bumpDetailsRefreshVersion: () => void;
  incrementUnread: (conversationKey: string) => void;
  upsertConversationFromMessage: (incomingMessage: Message, currentUserId: string) => void;
  getMessagesForConversation: (conversationKey: string) => Message[];
  resetConversationState: () => void;
  hydrateUnreadFromConversations: (conversations: Conversation[], currentUserId?: string) => void;
  markConversationSeen: (
    conversationId: string,
    readerId: string,
    seenAt: string,
    currentUserId?: string
  ) => void;
  addUploadJobs: (jobs: UploadJob[]) => void;
  updateUploadJob: (
    jobId: string,
    patch: Partial<Pick<UploadJob, "progress" | "status" | "error">>
  ) => void;
  removeUploadJob: (jobId: string) => void;
  clearCompletedUploads: () => void;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  userName: string;
  confirmPassword: string;
  gender: Gender | "";
}

export interface UploadRequestPayload {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface SendMessagePayload {
  messageType: MessageType;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
}

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

export interface SharedMediaItem {
  url: string;
  type: "image" | "video";
  createdAt: string;
}

export interface SharedLinkItem {
  url: string;
  title: string;
  createdAt: string;
}

export interface SharedDocumentItem {
  name: string;
  url: string;
  size?: number;
  createdAt: string;
}

export interface UserDetails {
  user: {
    _id: string;
    username: string;
    profilePic?: string;
    status: "online" | "offline";
  };
  media: SharedMediaItem[];
  links: SharedLinkItem[];
  documents: SharedDocumentItem[];
}