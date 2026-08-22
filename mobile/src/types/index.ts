// Phase-1 subset of frontend/src/types/index.ts — direct 1:1 text messaging
// only. Extend as later phases (groups, media, calls) get ported.

export type Gender = "male" | "female" | "others";
export type MessageType = "text" | "image" | "video" | "file" | "call_log";
export type CallType = "audio" | "video";
export type StoryType = "image" | "video" | "text";
export type StoryPrivacy = "everyone" | "close_friends";

export interface User {
  _id: string;
  email: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
  publicKey?: JsonWebKey | null;
  backupEnabled?: boolean;
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
  isAdmin?: boolean;
  isCreator?: boolean;
  addedByUserId?: string;
  addedByUserName?: string;
  joinedViaInvite?: boolean;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  displayName: string;
  displayAvatar?: string;
  participants: ConversationParticipant[];
  groupName?: string;
  groupAvatar?: string;
  createdBy?: string;
  admins?: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount?: number;
  seenAt?: string;
  isMuted?: boolean;
  isBlocked?: boolean;
  blockedByMe?: boolean;
  activeCall?: { callType: CallType; participantCount: number };
}

export interface EncryptedAesKeyEntry {
  userId: string;
  wrappedKey: string;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
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
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  reactions?: MessageReaction[];
  replyTo?: string | null;
  forwarded?: boolean;
  edited?: boolean;
  editedAt?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  callType?: CallType | null;
  callStatus?: "missed" | "declined" | "ended" | null;
  callDurationSec?: number | null;
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

export interface EncryptedLinkedSecret {
  encryptedPayload: string;
  encryptedAesKey: string;
  iv: string;
}

export interface LinkRequestDeviceInfo {
  platform?: string;
  browser?: string;
  label?: string;
}

export interface LinkRequestEventPayload {
  sessionId: string;
  requestedAt: string;
  expiresAt: string;
  deviceInfo?: LinkRequestDeviceInfo;
}

export interface LinkSessionUpdatedEventPayload {
  sessionId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  updatedAt: string;
}

export interface LinkSecretReadyEventPayload {
  sessionId: string;
  encryptedSecret: EncryptedLinkedSecret;
}

export type DeviceLinkStatus =
  | "checking"
  | "ready"
  | "needs_restore"
  | "pending"
  | "rejected"
  | "expired"
  | "error";

export interface CallParticipantInfo {
  userId: string;
  userName: string;
  profilePic?: string;
  streamUrl?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface IncomingCallPayload {
  conversationId: string;
  callType: CallType;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
}

export interface CallRosterSnapshotPayload {
  conversationId: string;
  callType: CallType;
  participantUserIds: string[];
}

export interface ServerToClientEvents {
  getOnlineUsers: (users: string[]) => void;
  newMessage: (message: Message) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string; seenAt: string }) => void;
  "conversation:muted": (payload: { conversationId: string; muted: boolean }) => void;
  "conversation:blocked": (payload: { conversationId: string; blocked: boolean; blockedByMe: boolean }) => void;
  "message:edit": (message: Message) => void;
  "message:delete": (message: Message) => void;
  "message:reaction": (message: Message) => void;
  "message:pin": (message: Message) => void;
  "conversation:membersAdded": (payload: { conversationId: string; addedUserIds: string[] }) => void;
  "conversation:memberRemoved": (payload: { conversationId: string; userId: string }) => void;
  "conversation:updated": (payload: { conversationId: string }) => void;
  "story:created": (payload: { storyId: string; userId: string }) => void;
  "story:viewed": (payload: { storyId: string; viewerId: string }) => void;
  "story:deleted": (payload: { storyId: string; userId: string }) => void;
  link_request: (payload: LinkRequestEventPayload) => void;
  link_session_updated: (payload: LinkSessionUpdatedEventPayload) => void;
  link_secret_ready: (payload: LinkSecretReadyEventPayload) => void;
  "call:incoming": (payload: IncomingCallPayload) => void;
  "call:started": (payload: { conversationId: string; callType: CallType; startedByUserId: string }) => void;
  "call:invite-resolved": (payload: { conversationId: string }) => void;
  "call:declined": (payload: { conversationId: string; byUserId: string }) => void;
  "call:ended": (payload: { conversationId: string; reason: "missed" | "ended" }) => void;
  "call:join-rejected": (payload: { conversationId: string; reason: "full" }) => void;
  "call:invite-rejected": (payload: { conversationId: string; reason: "unavailable" }) => void;
  "call:roster-snapshot": (payload: CallRosterSnapshotPayload) => void;
  "call:participant-joined": (payload: { conversationId: string; userId: string }) => void;
  "call:participant-left": (payload: { conversationId: string; userId: string }) => void;
  "call:offer": (payload: { conversationId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  "call:answer": (payload: { conversationId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  "call:ice-candidate": (payload: {
    conversationId: string;
    fromUserId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  "call:media-state": (payload: {
    conversationId: string;
    fromUserId: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  connect_error: (error: Error) => void;
  "conversation:seen": (payload: { conversationId: string; readerId: string }) => void;
  "story:viewed": (payload: { storyId: string }) => void;
  "call:invite": (payload: { conversationId: string; callType: CallType }) => void;
  "call:start": (payload: { conversationId: string; callType: CallType }) => void;
  "call:join": (payload: { conversationId: string; callType: CallType }) => void;
  "call:decline": (payload: { conversationId: string }) => void;
  "call:leave": (payload: { conversationId: string }) => void;
  "call:offer": (payload: { conversationId: string; toUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  "call:answer": (payload: { conversationId: string; toUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  "call:ice-candidate": (payload: {
    conversationId: string;
    toUserId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  "call:media-state": (payload: {
    conversationId: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
  }) => void;
}
