import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  getConversationById,
  getConversationMessages,
  sendMediaMessage,
  sendTextMessage,
} from "../../../../src/api/conversations";
import { getActiveCall } from "../../../../src/api/calls";
import { uploadAsset, type LocalAsset } from "../../../../src/api/upload";
import { ApiFetchError } from "../../../../src/api/client";
import {
  decryptMessageIfNeeded,
  decryptMessagesIfNeeded,
  encryptTextMessageForRecipients,
  getRecipientPublicKeys,
} from "../../../../src/crypto/crypto";
import { useAuthContext } from "../../../../src/context/AuthContext";
import { useSocketContext } from "../../../../src/context/SocketContext";
import { useCallContext } from "../../../../src/context/CallContext";
import useConversationStore from "../../../../src/store/useConversationStore";
import useMessageActions from "../../../../src/hooks/useMessageActions";
import Avatar from "../../../../src/components/Avatar";
import MessageBubble from "../../../../src/components/messages/MessageBubble";
import CallLogMessage from "../../../../src/components/messages/CallLogMessage";
import MessageActionSheet, { type MessageAction } from "../../../../src/components/messages/MessageActionSheet";
import ConversationDetailsDrawer from "../../../../src/components/details/ConversationDetailsDrawer";
import { colors } from "../../../../src/constants/theme";
import { formatDateSeparator } from "../../../../src/utils/formatTime";
import type {
  CallType,
  ConversationParticipant,
  ConversationType,
  Message,
} from "../../../../src/types";

// Must be a stable reference — `|| []` inline would create a new array on
// every store read, which useSyncExternalStore treats as a change and loops.
const EMPTY_MESSAGES: Message[] = [];

// Same tiled wallpaper as the web app's chat pane.
const CHAT_WALLPAPER = require("../../../../assets/chat-wallpaper.webp");

type ChatListItem =
  | { type: "message"; key: string; message: Message }
  | { type: "separator"; key: string; label: string };

const buildChatItems = (chronological: Message[]): ChatListItem[] => {
  const items: ChatListItem[] = [];
  let lastDateKey: string | null = null;

  chronological.forEach((message, index) => {
    const dateKey = new Date(message.createdAt).toDateString();
    if (dateKey !== lastDateKey) {
      items.push({ type: "separator", key: `sep-${dateKey}`, label: formatDateSeparator(message.createdAt) });
      lastDateKey = dateKey;
    }
    items.push({ type: "message", key: message._id || `pending-${index}`, message });
  });

  // Reversed for the inverted FlatList — newest first, each day's separator
  // still reads as sitting above that day's group once inversion flips it back.
  return items.reverse();
};

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id as string;
  const { socket, onlineUsers } = useSocketContext();
  const { startCall, startGroupCall, joinCall, callBanners, seedCallBanner } = useCallContext();

  const storedConversation = useConversationStore((state) =>
    state.conversations.find((conversation) => conversation._id === conversationId)
  );
  const messages = useConversationStore((state) => state.messagesByConversation[conversationId] || EMPTY_MESSAGES);
  const setMessagesForConversation = useConversationStore((state) => state.setMessagesForConversation);
  const appendMessageToConversation = useConversationStore((state) => state.appendMessageToConversation);

  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    storedConversation?.participants || []
  );
  const [conversationType, setConversationType] = useState<ConversationType>(
    storedConversation?.type || "direct"
  );
  const [groupName, setGroupName] = useState<string>(storedConversation?.displayName || "");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);

  const participantIds = useMemo(() => participants.map((participant) => participant._id), [participants]);
  const { editMessage, reactToMessage, togglePin, deleteMessage } = useMessageActions({
    conversationId,
    currentUserId,
    participantIds,
  });

  // Driven directly off Keyboard events instead of KeyboardAvoidingView —
  // on Android its behaviors fight with the Activity's adjustResize, and
  // react-native-screens doesn't reliably propagate that resize to content.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const otherParticipant = useMemo(
    () => participants.find((participant) => participant._id !== currentUserId) || participants[0],
    [participants, currentUserId]
  );

  useEffect(() => {
    if (storedConversation) {
      setParticipants(storedConversation.participants);
      setConversationType(storedConversation.type);
      setGroupName(storedConversation.displayName);
      return;
    }

    void getConversationById(conversationId).then((conversation) => {
      setParticipants(conversation.participants);
      setConversationType(conversation.type);
      if (conversation.groupName) setGroupName(conversation.groupName);
    });
  }, [conversationId, storedConversation]);

  const isGroup = conversationType === "group";
  const isOtherParticipantOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));
  const isBlocked = Boolean(storedConversation?.isBlocked);
  const blockedByMe = Boolean(storedConversation?.blockedByMe);
  const activeBanner = callBanners[conversationId];

  useEffect(() => {
    if (!isGroup) return;

    void getActiveCall(conversationId)
      .then((snapshot) => {
        seedCallBanner(
          conversationId,
          snapshot ? { callType: snapshot.callType, participantCount: snapshot.participantCount } : null
        );
      })
      .catch(() => undefined);
  }, [conversationId, isGroup, seedCallBanner]);

  const handleStartCall = useCallback(
    (callType: CallType) => {
      if (isBlocked) {
        Alert.alert("Can't call", "You can't call this contact right now.");
        return;
      }

      if (isGroup) {
        void startGroupCall(conversationId, callType);
        return;
      }

      void startCall(conversationId, callType);
    },
    [isBlocked, isGroup, conversationId, startCall, startGroupCall]
  );

  const headerTitle = isGroup ? groupName : otherParticipant?.userName || "";
  const headerSubtitle = isGroup
    ? `${participants.length} members`
    : isOtherParticipantOnline
      ? "Online"
      : "";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitleRow}
          activeOpacity={0.7}
          onPress={() => setDetailsOpen(true)}
        >
          <Avatar
            id={isGroup ? conversationId : otherParticipant?._id || conversationId}
            name={headerTitle}
            uri={isGroup ? storedConversation?.displayAvatar : otherParticipant?.profilePic}
            gender={isGroup ? undefined : otherParticipant?.gender}
            isGroup={isGroup}
            size={34}
            online={!isGroup && isOtherParticipantOnline}
          />
          <View style={styles.headerTitleTextGroup}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {headerTitle}
            </Text>
            {Boolean(headerSubtitle) && (
              <Text style={[styles.headerSubtitleText, isGroup && styles.headerSubtitleMuted]}>
                {headerSubtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => handleStartCall("audio")} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="call-outline" size={21} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleStartCall("video")} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="videocam-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDetailsOpen(true)} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="information-circle-outline" size={23} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [
    navigation,
    conversationId,
    isGroup,
    otherParticipant,
    headerTitle,
    headerSubtitle,
    isOtherParticipantOnline,
    storedConversation?.displayAvatar,
    handleStartCall,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);

    void getConversationMessages(conversationId)
      .then(async ({ messages: history }) => {
        const decrypted = await decryptMessagesIfNeeded(history, currentUserId);
        if (!cancelled) setMessagesForConversation(conversationId, decrypted);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUserId, setMessagesForConversation]);

  // Marks the thread read once its history is on screen, and again whenever a
  // new message lands while it stays open.
  const messageCount = messages.length;
  const seenSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !currentUserId || loadingHistory) return;

    const signature = `${conversationId}:${messageCount}`;
    if (seenSyncedRef.current === signature) return;

    seenSyncedRef.current = signature;
    socket.emit("conversation:seen", { conversationId, readerId: currentUserId });
  }, [socket, conversationId, currentUserId, messageCount, loadingHistory]);

  const items = useMemo(() => buildChatItems(messages), [messages]);

  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach((message) => {
      if (message._id) map.set(message._id, message);
    });
    return map;
  }, [messages]);

  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((participant) => map.set(participant._id, participant.userName));
    return map;
  }, [participants]);

  const resetComposerContext = () => {
    setReplyTarget(null);
    setEditTarget(null);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (isBlocked || !text || participants.length === 0 || sending) return;

    if (editTarget) {
      const target = editTarget;
      setDraft("");
      resetComposerContext();
      setSending(true);

      const ok = await editMessage(target, text);
      if (!ok) {
        setDraft(text);
        setEditTarget(target);
        setSendError("Failed to edit message");
      }

      setSending(false);
      return;
    }

    const replyToId = replyTarget?._id;
    setDraft("");
    resetComposerContext();
    setSendError(null);
    setSending(true);

    try {
      const recipients = await getRecipientPublicKeys(participantIds);
      const payload = await encryptTextMessageForRecipients(text, recipients);
      const sentMessage = await sendTextMessage(conversationId, { ...payload, replyTo: replyToId });
      const hydrated = await decryptMessageIfNeeded(sentMessage, currentUserId);
      appendMessageToConversation(conversationId, hydrated);
    } catch (error: unknown) {
      setDraft(text);
      setSendError(error instanceof ApiFetchError ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const sendAsset = async (asset: LocalAsset) => {
    setUploading(true);
    setSendError(null);

    try {
      const uploaded = await uploadAsset(asset);
      const sentMessage = await sendMediaMessage(conversationId, {
        ...uploaded,
        replyTo: replyTarget?._id,
      });
      appendMessageToConversation(conversationId, sentMessage);
      resetComposerContext();
    } catch (error: unknown) {
      setSendError(error instanceof ApiFetchError ? error.message : "Failed to send attachment");
    } finally {
      setUploading(false);
    }
  };

  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to share media.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    await sendAsset({
      uri: asset.uri,
      name: asset.fileName || `upload-${Date.now()}.${asset.uri.split(".").pop() || "jpg"}`,
      mimeType: asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      size: asset.fileSize,
    });
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    await sendAsset({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || "application/octet-stream",
      size: asset.size,
    });
  };

  const handleAttach = () => {
    Alert.alert("Share attachment", undefined, [
      { text: "Photo or video", onPress: () => void handlePickMedia() },
      { text: "Document", onPress: () => void handlePickDocument() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleAction = async (action: MessageAction) => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) return;

    switch (action) {
      case "reply":
        setEditTarget(null);
        setReplyTarget(target);
        break;
      case "copy":
        await Clipboard.setStringAsync(target.text || target.message || "");
        break;
      case "edit":
        setReplyTarget(null);
        setEditTarget(target);
        setDraft(target.text || target.message || "");
        break;
      case "pin":
        await togglePin(target);
        break;
      case "forward":
        router.push({
          pathname: "/forward",
          params: { conversationId, messageId: target._id as string },
        });
        break;
      case "delete":
        Alert.alert("Delete message", undefined, [
          { text: "Delete for me", onPress: () => void deleteMessage(target, "me") },
          ...(target.senderId === currentUserId
            ? [
                {
                  text: "Delete for everyone",
                  style: "destructive" as const,
                  onPress: () => void deleteMessage(target, "everyone"),
                },
              ]
            : []),
          { text: "Cancel", style: "cancel" as const },
        ]);
        break;
    }
  };

  const pinnedMessage = useMemo(
    () => [...messages].reverse().find((message) => message.pinned),
    [messages]
  );

  if (loadingHistory && messages.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const composerContext = editTarget || replyTarget;

  return (
    <View style={[styles.flex, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + insets.bottom : 0 }]}>
      {isGroup && activeBanner && (
        <View style={styles.callBanner}>
          <Ionicons
            name={activeBanner.callType === "video" ? "videocam" : "call"}
            size={18}
            color={colors.primaryDark}
          />
          <Text style={styles.callBannerText}>
            Ongoing {activeBanner.callType} call · {activeBanner.participantCount}
          </Text>
          <TouchableOpacity
            style={styles.callBannerButton}
            onPress={() => void joinCall(conversationId, activeBanner.callType)}
          >
            <Text style={styles.callBannerButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      )}

      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Ionicons name="pin" size={15} color={colors.primary} />
          <Text style={styles.pinnedBannerText} numberOfLines={1}>
            {pinnedMessage.text || pinnedMessage.message || pinnedMessage.fileName || "Pinned message"}
          </Text>
          <TouchableOpacity onPress={() => void togglePin(pinnedMessage)} hitSlop={8}>
            <Ionicons name="close" size={17} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      )}

      <ImageBackground source={CHAT_WALLPAPER} resizeMode="repeat" style={styles.flex}>
        <View style={styles.wallpaperOverlay} pointerEvents="none" />
        {items.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.textFaint} />
            <Text style={styles.emptyChatText}>No messages yet — say hi</Text>
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            data={items}
            keyExtractor={(item) => item.key}
            inverted
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (item.type === "separator") {
                return (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>{item.label}</Text>
                  </View>
                );
              }

              const isMine = item.message.senderId === currentUserId;

              // Calls are shared events rather than authored content, so they
              // render as a centered system row instead of a side bubble.
              if (item.message.messageType === "call_log") {
                return (
                  <CallLogMessage
                    message={item.message}
                    currentUserId={currentUserId}
                    otherUserName={otherParticipant?.userName}
                    canCallBack={!isGroup && !isBlocked && item.message.callStatus === "missed" && !isMine}
                    onCallBack={handleStartCall}
                  />
                );
              }

              return (
                <MessageBubble
                  message={item.message}
                  isMine={isMine}
                  senderName={participantNameById.get(item.message.senderId)}
                  showSenderName={isGroup && !isMine}
                  replyTarget={item.message.replyTo ? messagesById.get(item.message.replyTo) : undefined}
                  onLongPress={setActionTarget}
                />
              );
            }}
          />
        )}
      </ImageBackground>

      {sendError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{sendError}</Text>
        </View>
      )}

      {isBlocked ? (
        <View style={[styles.blockBanner, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
          <View style={styles.blockIcon}>
            <Ionicons name="ban" size={18} color={colors.danger} />
          </View>
          <Text style={styles.blockBannerText}>
            {blockedByMe
              ? "You blocked this contact. Unblock to send messages."
              : "You can't message this contact right now."}
          </Text>
        </View>
      ) : (
        <View style={styles.composerWrapper}>
          {composerContext && (
            <View style={styles.composerContext}>
              <Ionicons
                name={editTarget ? "create-outline" : "arrow-undo-outline"}
                size={15}
                color={colors.primary}
              />
              <View style={styles.composerContextText}>
                <Text style={styles.composerContextTitle}>{editTarget ? "Editing" : "Replying"}</Text>
                <Text style={styles.composerContextBody} numberOfLines={1}>
                  {composerContext.text || composerContext.message || composerContext.fileName || "Attachment"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  resetComposerContext();
                  if (editTarget) setDraft("");
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={17} color={colors.textFaint} />
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              styles.composer,
              { paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 10) + 8 },
            ]}
          >
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleAttach}
              disabled={uploading || Boolean(editTarget)}
            >
              {uploading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.textFaint}
              value={draft}
              onChangeText={setDraft}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || !draft.trim() || participants.length === 0) && styles.sendButtonDisabled,
              ]}
              onPress={() => void handleSend()}
              disabled={sending || !draft.trim() || participants.length === 0}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name={editTarget ? "checkmark" : "send"} size={17} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ConversationDetailsDrawer
        conversationId={conversationId}
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />

      <MessageActionSheet
        message={actionTarget}
        isMine={actionTarget?.senderId === currentUserId}
        currentUserId={currentUserId}
        onClose={() => setActionTarget(null)}
        onReact={(emoji) => {
          const target = actionTarget;
          setActionTarget(null);
          if (target) void reactToMessage(target, emoji);
        }}
        onAction={(action) => void handleAction(action)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitleTextGroup: { maxWidth: 180 },
  headerTitleText: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerSubtitleText: { fontSize: 12, color: colors.online, marginTop: 1 },
  headerSubtitleMuted: { color: colors.textMuted },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16, marginRight: 4 },
  headerButton: { padding: 2 },
  callBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
  },
  callBannerText: { flex: 1, fontSize: 13.5, color: colors.primaryDark, fontWeight: "500" },
  callBannerButton: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7 },
  callBannerButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pinnedBannerText: { flex: 1, fontSize: 13, color: colors.textMuted },
  wallpaperOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(238, 242, 255, 0.55)",
  },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 60 },
  emptyChatText: { color: colors.textMuted, fontSize: 14 },
  dateSeparator: { alignItems: "center", marginVertical: 12 },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  errorBanner: { backgroundColor: colors.dangerBackground, paddingVertical: 6, paddingHorizontal: 14 },
  errorBannerText: { color: colors.danger, fontSize: 12.5, textAlign: "center" },
  blockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  blockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  blockBannerText: { flex: 1, fontSize: 13.5, color: colors.textMuted },
  composerWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  composerContextText: { flex: 1 },
  composerContextTitle: { fontSize: 12, fontWeight: "700", color: colors.primary },
  composerContextBody: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8 },
  attachButton: { paddingBottom: 9, paddingHorizontal: 2 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: colors.borderStrong },
});
