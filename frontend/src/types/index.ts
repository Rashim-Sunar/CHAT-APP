import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

export type Gender = "male" | "female" | "others";
// "call_log" is a system message (no sender-authored content) summarizing a
// finished call — distinct from "video", which is an uploaded video FILE
// message. Do not conflate the two.
export type MessageType = "text" | "image" | "video" | "file" | "call_log";
export type ResourceType = "image" | "video" | "raw";
export type CallType = "audio" | "video";
export type CallStatus = "missed" | "declined" | "ended";

export interface User {
  _id: string;
  email: string;
  userName: string;
  gender: Gender;
  profilePic?: string;
  publicKey?: JsonWebKey | null;
  backupEnabled?: boolean;
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

export interface EncryptedLinkedSecret {
  encryptedPayload: string;
  encryptedAesKey: string;
  iv: string;
}

export interface LinkRequestDeviceInfo {
  userAgent?: string;
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
  | "restoring"
  | "pending"
  | "rejected"
  | "expired"
  | "error";

export interface LinkSessionStatusResponse {
  status: "success" | "fail";
  message?: string;
  data?: {
    sessionId: string;
    status: "pending" | "approved" | "rejected" | "expired";
    expiresAt: string;
  };
}

export interface DeviceLinkContextValue {
  status: DeviceLinkStatus;
  sessionId: string | null;
  error: string | null;
  backupEnabled: boolean;
  isEnablingBackup: boolean;
  incomingRequests: LinkRequestEventPayload[];
  startDeviceLinking: () => Promise<void>;
  restoreFromBackup: (password: string) => Promise<void>;
  enableBackup: (password: string) => Promise<void>;
  approveRequest: (sessionId: string) => Promise<void>;
  rejectRequest: (sessionId: string) => Promise<void>;
  clearRequest: (sessionId: string) => void;
}

export interface UserKeyPairJwk {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
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
  _id: string; // real conversation id (not a user id)
  type: ConversationType;
  // Server-computed so components never need to branch on `type` themselves:
  // the other user's name/photo for direct, groupName/groupAvatar for group.
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
  __isPlaceholder?: boolean;
  activeCall?: { callType: CallType; participantCount: number };
  isMuted?: boolean;
  // Direct conversations only — symmetric (true if either side blocked the
  // other). blockedByMe controls whether the UI offers "Unblock" vs. just a
  // disabled state.
  isBlocked?: boolean;
  blockedByMe?: boolean;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
}

export interface EncryptedAesKeyEntry {
  userId: string;
  wrappedKey: string;
}

export interface Message {
  _id?: string;
  conversationId?: string;
  senderId: string;
  // Populated for direct messages only; absent/null for group messages,
  // which have no single recipient.
  receiverId?: string | null;
  messageType: MessageType;
  text?: string;
  message?: string;
  encryptedMessage?: string;
  // Legacy single-string dual-wrap envelope, kept only as a decrypt-side
  // fallback during the schema migration window.
  encryptedAESKey?: string;
  encryptedAESKeys?: EncryptedAesKeyEntry[];
  iv?: string;
  decryptionFailed?: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  publicId?: string | null;
  edited?: boolean;
  editedAt?: string;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  reactions?: MessageReaction[];
  replyTo?: string | null;
  forwarded?: boolean;
  // Only set when messageType === "call_log".
  callType?: CallType | null;
  callStatus?: CallStatus | null;
  callDurationSec?: number | null;
  pinned?: boolean;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
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

// One entry per remote peer in an active call, keyed by userId — holds the
// live MediaStream/mute state the CallVideoGrid renders. Not a wire payload;
// assembled client-side in CallContext from roster + track events.
export interface CallParticipantInfo {
  userId: string;
  userName: string;
  profilePic?: string;
  stream?: MediaStream;
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
  "message:edit": (message: Message) => void;
  "message:delete": (message: Message) => void;
  "message:reaction": (message: Message) => void;
  "message:pin": (message: Message) => void;
  "conversation:updated": (payload: { conversationId: string; groupName?: string; groupAvatar?: string }) => void;
  "conversation:membersAdded": (payload: { conversationId: string; addedUserIds: string[] }) => void;
  "conversation:memberRemoved": (payload: { conversationId: string; removedUserId: string }) => void;
  "conversation:adminPromoted": (payload: { conversationId: string; newAdminUserId: string }) => void;
  "conversation:muted": (payload: { conversationId: string; muted: boolean }) => void;
  "conversation:blocked": (payload: { conversationId: string; blocked: boolean; blockedByMe: boolean }) => void;
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
  "call:media-state": (payload: { conversationId: string; audioEnabled: boolean; videoEnabled: boolean }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketContextValue {
  socket: AppSocket | null;
  onlineUsers: string[];
}

export interface AuthContextValue {
  authUser: AuthResponse | null;
  setAuthUser: Dispatch<SetStateAction<AuthResponse | null>>;
  loading: boolean;
}

export interface ConversationState {
  selectedConversation: Conversation | null;
  activeChat: Conversation | null;
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  unreadByConversation: Record<string, number>;
  hasMoreByConversation: Record<string, boolean>;
  uploadQueue: UploadJob[];
  detailsRefreshVersion: number;
  replyTarget: Message | null;
  setReplyTarget: (message: Message | null) => void;
  setSelectedConversation: (
    selectedConversation: Conversation | null,
    currentUserId?: string
  ) => void;
  setConversations: (conversations: Conversation[]) => void;
  setMessagesForConversation: (conversationKey: string, messages: Message[]) => void;
  prependMessagesToConversation: (conversationKey: string, messages: Message[]) => void;
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
  setHasMore: (conversationKey: string, hasMore: boolean) => void;
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
  encryptedMessage?: string;
  encryptedAESKeys?: EncryptedAesKeyEntry[];
  iv?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  replyTo?: string;
  forwarded?: boolean;
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

export type StoryType = "image" | "video" | "text";
export type StoryPrivacy = "everyone" | "close_friends";

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

export interface SharedContentResponse {
  media: SharedMediaItem[];
  links: SharedLinkItem[];
  documents: SharedDocumentItem[];
}