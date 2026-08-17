import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getConversationById, getConversationMessages, sendTextMessage } from "../../../src/api/conversations";
import { ApiFetchError } from "../../../src/api/client";
import {
  decryptMessageIfNeeded,
  decryptMessagesIfNeeded,
  encryptTextMessageForRecipients,
  getRecipientPublicKeys,
} from "../../../src/crypto/crypto";
import { useAuthContext } from "../../../src/context/AuthContext";
import { useSocketContext } from "../../../src/context/SocketContext";
import useConversationStore from "../../../src/store/useConversationStore";
import Avatar from "../../../src/components/Avatar";
import { colors } from "../../../src/constants/theme";
import { formatClockTime, formatDateSeparator } from "../../../src/utils/formatTime";
import type { ConversationParticipant, Message } from "../../../src/types";

// Must be a stable reference — `|| []` inline would create a new array on
// every store read, which useSyncExternalStore treats as a change and loops.
const EMPTY_MESSAGES: Message[] = [];

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
  const { onlineUsers } = useSocketContext();

  const storedConversation = useConversationStore((state) =>
    state.conversations.find((conversation) => conversation._id === conversationId)
  );
  const messages = useConversationStore((state) => state.messagesByConversation[conversationId] || EMPTY_MESSAGES);
  const setMessagesForConversation = useConversationStore((state) => state.setMessagesForConversation);
  const appendMessageToConversation = useConversationStore((state) => state.appendMessageToConversation);

  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    storedConversation?.participants || []
  );
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Driven directly off Keyboard events instead of KeyboardAvoidingView —
  // on Android, its "height"/"padding" behaviors fight with the native
  // windowSoftInputMode=adjustResize also active on this Activity, and
  // react-native-screens' native screen hosting doesn't reliably propagate
  // that resize down to our content either way. Measuring the keyboard
  // ourselves sidesteps both.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

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
      return;
    }

    // Not in the store yet — e.g. a conversation just created via
    // new-chat.tsx, which navigates here directly without refreshing the list.
    void getConversationById(conversationId).then((conversation) => {
      setParticipants(conversation.participants);
    });
  }, [conversationId, storedConversation]);

  const isOtherParticipantOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));

  useLayoutEffect(() => {
    if (!otherParticipant) return;

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleRow}>
          <Avatar
            id={otherParticipant._id}
            name={otherParticipant.userName}
            uri={otherParticipant.profilePic}
            size={34}
            online={isOtherParticipantOnline}
          />
          <View style={styles.headerTitleTextGroup}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {otherParticipant.userName}
            </Text>
            {isOtherParticipantOnline && <Text style={styles.headerSubtitleText}>Online</Text>}
          </View>
        </View>
      ),
    });
  }, [navigation, otherParticipant, isOtherParticipantOnline]);

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

  const items = useMemo(() => buildChatItems(messages), [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || participants.length === 0 || sending) return;

    setDraft("");
    setSendError(null);
    setSending(true);

    try {
      const recipients = await getRecipientPublicKeys(participants.map((participant) => participant._id));
      const payload = await encryptTextMessageForRecipients(text, recipients);
      const sentMessage = await sendTextMessage(conversationId, payload);
      const hydrated = await decryptMessageIfNeeded(sentMessage, currentUserId);
      appendMessageToConversation(conversationId, hydrated);
    } catch (error: unknown) {
      setDraft(text);
      setSendError(error instanceof ApiFetchError ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loadingHistory && messages.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + insets.bottom : 0 }]}>
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

            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleTheirs,
                    isMine ? styles.bubbleTailMine : styles.bubbleTailTheirs,
                  ]}
                >
                  <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                    {item.message.text ?? item.message.message ?? ""}
                  </Text>
                  <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatClockTime(item.message.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {sendError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{sendError}</Text>
        </View>
      )}

      <View
        style={[
          styles.composer,
          { paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 10) + 8 },
        ]}
      >
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
            <Ionicons name="send" size={17} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
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
  bubbleRow: { marginVertical: 2 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubbleRowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 6,
  },
  bubbleMine: { backgroundColor: colors.bubbleMine },
  bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderWidth: 1, borderColor: colors.border },
  bubbleTailMine: { borderBottomRightRadius: 4 },
  bubbleTailTheirs: { borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: colors.bubbleTextMine, fontSize: 15.5, lineHeight: 20 },
  bubbleTextTheirs: { color: colors.bubbleTextTheirs, fontSize: 15.5, lineHeight: 20 },
  bubbleTime: { fontSize: 10.5, marginTop: 3, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
  bubbleTimeTheirs: { color: colors.textFaint },
  errorBanner: { backgroundColor: colors.dangerBackground, paddingVertical: 6, paddingHorizontal: 14 },
  errorBannerText: { color: colors.danger, fontSize: 12.5, textAlign: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
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
