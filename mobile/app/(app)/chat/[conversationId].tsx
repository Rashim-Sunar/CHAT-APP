import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getConversationById, getConversationMessages, sendTextMessage } from "../../../src/api/conversations";
import { ApiFetchError } from "../../../src/api/client";
import {
  decryptMessageIfNeeded,
  decryptMessagesIfNeeded,
  encryptTextMessageForRecipients,
  getRecipientPublicKeys,
} from "../../../src/crypto/crypto";
import { useAuthContext } from "../../../src/context/AuthContext";
import useConversationStore from "../../../src/store/useConversationStore";
import type { ConversationParticipant, Message } from "../../../src/types";

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const navigation = useNavigation();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id as string;

  const storedConversation = useConversationStore((state) =>
    state.conversations.find((conversation) => conversation._id === conversationId)
  );
  const messages = useConversationStore((state) => state.messagesByConversation[conversationId] || []);
  const setMessagesForConversation = useConversationStore((state) => state.setMessagesForConversation);
  const appendMessageToConversation = useConversationStore((state) => state.appendMessageToConversation);

  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    storedConversation?.participants || []
  );
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (storedConversation) {
      setParticipants(storedConversation.participants);
      navigation.setOptions({ title: storedConversation.displayName });
      return;
    }

    // Not in the store yet — e.g. a conversation just created via
    // new-chat.tsx, which navigates here directly without refreshing the list.
    void getConversationById(conversationId).then((conversation) => {
      setParticipants(conversation.participants);
      const other = conversation.participants.find((participant) => participant._id !== currentUserId);
      navigation.setOptions({ title: other?.userName || "Chat" });
    });
  }, [conversationId, storedConversation, currentUserId, navigation]);

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

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        style={styles.flex}
        data={orderedMessages}
        keyExtractor={(item, index) => item._id || `pending-${index}`}
        inverted
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                {item.text ?? item.message ?? ""}
              </Text>
            </View>
          );
        }}
      />

      {sendError && <Text style={styles.errorBanner}>{sendError}</Text>}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => void handleSend()}
          disabled={sending || !draft.trim() || participants.length === 0}
        >
          <Text style={styles.sendButtonText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 3,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#4f46e5" },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: "#f3f4f6" },
  bubbleTextMine: { color: "#fff", fontSize: 15 },
  bubbleTextTheirs: { color: "#111827", fontSize: 15 },
  errorBanner: {
    color: "#dc2626",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 4,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
