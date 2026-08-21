import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { sendMediaMessage, sendTextMessage } from "../../src/api/conversations";
import { encryptTextMessageForRecipients, getRecipientPublicKeys } from "../../src/crypto/crypto";
import { useAuthContext } from "../../src/context/AuthContext";
import useConversationStore from "../../src/store/useConversationStore";
import Avatar from "../../src/components/Avatar";
import { colors } from "../../src/constants/theme";

export default function ForwardScreen() {
  const { conversationId, messageId } = useLocalSearchParams<{ conversationId: string; messageId: string }>();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const conversations = useConversationStore((state) => state.conversations);
  const sourceMessage = useConversationStore((state) =>
    (state.messagesByConversation[conversationId] || []).find((message) => message._id === messageId)
  );

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const available = conversations.filter((conversation) => conversation._id !== conversationId);
    if (!query) return available;
    return available.filter((conversation) => conversation.displayName.toLowerCase().includes(query));
  }, [conversations, conversationId, search]);

  const handleForward = async () => {
    if (!sourceMessage) return;

    setSending(true);
    setError(null);

    try {
      for (const targetId of selectedIds) {
        const target = conversations.find((conversation) => conversation._id === targetId);
        if (!target) continue;

        if (sourceMessage.messageType === "text") {
          // Text is re-encrypted for the destination's participants — the
          // original envelope is only readable by the source conversation.
          const plainText = sourceMessage.text || sourceMessage.message || "";
          const participantIds = target.participants.map((participant) => participant._id);
          const recipients = await getRecipientPublicKeys(participantIds);

          if (recipients.length < participantIds.length) {
            throw new Error("One or more participants haven't set up encryption yet");
          }

          const encrypted = await encryptTextMessageForRecipients(plainText, recipients);
          await sendTextMessage(targetId, { ...encrypted, forwarded: true });
        } else {
          // Media reuses the existing upload rather than re-uploading it.
          await sendMediaMessage(targetId, {
            messageType: sourceMessage.messageType as "image" | "video" | "file",
            fileUrl: sourceMessage.fileUrl as string,
            fileName: sourceMessage.fileName,
            fileSize: sourceMessage.fileSize,
            mimeType: sourceMessage.mimeType,
            publicId: sourceMessage.publicId,
            forwarded: true,
          });
        }
      }

      router.back();
    } catch (forwardError: unknown) {
      setError(forwardError instanceof Error ? forwardError.message : "Failed to forward message");
    } finally {
      setSending(false);
    }
  };

  if (!sourceMessage) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Message unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats"
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={targets}
        keyExtractor={(item) => item._id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No other chats to forward to.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item._id);
          const isGroup = item.type === "group";
          const otherParticipant = isGroup
            ? undefined
            : item.participants.find((participant) => participant._id !== currentUserId);

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() =>
                setSelectedIds((prev) =>
                  prev.includes(item._id) ? prev.filter((id) => id !== item._id) : [...prev, item._id]
                )
              }
            >
              <Avatar
                id={item._id}
                name={item.displayName}
                uri={item.displayAvatar}
                gender={otherParticipant?.gender}
                isGroup={isGroup}
                size={44}
              />
              <Text style={styles.rowName} numberOfLines={1}>
                {item.displayName}
              </Text>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Text style={styles.footerCount}>{selectedIds.length} selected</Text>
        <TouchableOpacity
          style={[styles.primaryButton, (sending || selectedIds.length === 0) && styles.buttonDisabled]}
          onPress={() => void handleForward()}
          disabled={sending || selectedIds.length === 0}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 74 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  rowName: { flex: 1, fontSize: 15.5, fontWeight: "500", color: colors.text },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.danger, fontSize: 13, textAlign: "center", paddingBottom: 6 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerCount: { flex: 1, fontSize: 14, color: colors.textMuted },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
    minWidth: 92,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
