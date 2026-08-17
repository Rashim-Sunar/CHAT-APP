import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getPinnedMessages,
  getSharedContent,
  listConversations,
  setConversationMuted,
  setUserBlocked,
} from "../../../../src/api/conversations";
import { decryptMessagesIfNeeded } from "../../../../src/crypto/crypto";
import { useAuthContext } from "../../../../src/context/AuthContext";
import useConversationStore from "../../../../src/store/useConversationStore";
import Avatar from "../../../../src/components/Avatar";
import { colors } from "../../../../src/constants/theme";
import { formatRelativeTime } from "../../../../src/utils/formatTime";
import type { Message, SharedContentResponse } from "../../../../src/types";

const EMPTY_SHARED_CONTENT: SharedContentResponse = { media: [], links: [], documents: [] };

export default function ConversationDetailsScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id as string;

  const conversation = useConversationStore((state) =>
    state.conversations.find((item) => item._id === conversationId)
  );
  const setConversations = useConversationStore((state) => state.setConversations);

  const otherParticipant = conversation?.participants.find((participant) => participant._id !== currentUserId);

  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [sharedContent, setSharedContent] = useState<SharedContentResponse>(EMPTY_SHARED_CONTENT);
  const [loading, setLoading] = useState(true);
  const [muteBusy, setMuteBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getPinnedMessages(conversationId), getSharedContent(conversationId)]).then(
      async ([pinned, shared]) => {
        const decryptedPinned = await decryptMessagesIfNeeded(pinned, currentUserId);
        if (cancelled) return;
        setPinnedMessages(decryptedPinned);
        setSharedContent(shared);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUserId]);

  // Mute/block flags live on the conversation summary from listConversations,
  // not on a single-conversation endpoint — refetching the whole list after
  // an action is simpler than adding a dedicated store-patch method for
  // what's still just direct conversations in phase 1.
  const refreshConversations = async () => {
    const all = await listConversations();
    setConversations(all.filter((item) => item.type === "direct"));
  };

  const handleToggleMute = async (nextMuted: boolean) => {
    setMuteBusy(true);
    try {
      await setConversationMuted(conversationId, nextMuted);
      await refreshConversations();
    } finally {
      setMuteBusy(false);
    }
  };

  const handleToggleBlock = async (nextBlocked: boolean) => {
    setBlockBusy(true);
    try {
      await setUserBlocked(conversationId, nextBlocked);
      await refreshConversations();
    } finally {
      setBlockBusy(false);
    }
  };

  if (!conversation || !otherParticipant) return null;

  const isMuted = Boolean(conversation.isMuted);
  const isBlocked = Boolean(conversation.isBlocked);
  const blockedByMe = Boolean(conversation.blockedByMe);
  const hasSharedContent = sharedContent.media.length + sharedContent.links.length + sharedContent.documents.length > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.profileSection}>
        <Avatar
          id={otherParticipant._id}
          name={otherParticipant.userName}
          uri={otherParticipant.profilePic}
          gender={otherParticipant.gender}
          size={88}
        />
        <Text style={styles.name}>{otherParticipant.userName}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="notifications-off-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowLabel}>Mute notifications</Text>
          <Switch
            value={isMuted}
            onValueChange={(next) => void handleToggleMute(next)}
            disabled={muteBusy}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={isMuted ? colors.primary : "#fff"}
          />
        </View>
      </View>

      <View style={styles.card}>
        {blockedByMe && (
          <Text style={styles.blockHint}>You blocked this contact. Unblock to send and receive messages.</Text>
        )}
        {isBlocked && !blockedByMe && (
          <Text style={styles.blockHint}>This contact has blocked you. You can&apos;t message right now.</Text>
        )}
        {!isBlocked || blockedByMe ? (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            disabled={blockBusy}
            onPress={() => void handleToggleBlock(!blockedByMe)}
          >
            <Ionicons name="ban-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, styles.dangerText]}>
              {blockedByMe ? "Unblock contact" : "Block contact"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pinned messages</Text>
      </View>
      <View style={styles.card}>
        {pinnedMessages.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? "Loading…" : "No pinned messages"}</Text>
        ) : (
          pinnedMessages.map((message) => (
            <View key={message._id} style={styles.pinnedItem}>
              <Ionicons name="pin" size={14} color={colors.primary} style={styles.pinnedIcon} />
              <View style={styles.pinnedTextGroup}>
                <Text style={styles.pinnedText} numberOfLines={2}>
                  {message.text || message.message || ""}
                </Text>
                <Text style={styles.pinnedMeta}>{formatRelativeTime(message.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shared media</Text>
      </View>
      <View style={styles.card}>
        {sharedContent.media.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? "Loading…" : "No media shared yet"}</Text>
        ) : (
          <View style={styles.mediaGrid}>
            {sharedContent.media.map((item) => (
              <TouchableOpacity key={item.url} onPress={() => void Linking.openURL(item.url)}>
                <View style={styles.mediaThumb}>
                  <Ionicons name={item.type === "video" ? "videocam" : "image"} size={22} color={colors.textFaint} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Links</Text>
      </View>
      <View style={styles.card}>
        {sharedContent.links.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? "Loading…" : "No links shared yet"}</Text>
        ) : (
          sharedContent.links.map((link) => (
            <TouchableOpacity
              key={link.url}
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => void Linking.openURL(link.url)}
            >
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>
                {link.title || link.url}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Documents</Text>
      </View>
      <View style={[styles.card, styles.lastCard]}>
        {sharedContent.documents.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? "Loading…" : "No documents shared yet"}</Text>
        ) : (
          sharedContent.documents.map((doc) => (
            <TouchableOpacity
              key={doc.url}
              style={styles.row}
              activeOpacity={0.6}
              onPress={() => void Linking.openURL(doc.url)}
            >
              <Ionicons name="document-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>
                {doc.name}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {!hasSharedContent && !loading && (
        <Text style={styles.footerNote}>Media and files aren&apos;t supported from mobile yet — text only.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  profileSection: { alignItems: "center", backgroundColor: colors.surface, paddingVertical: 28, gap: 10 },
  name: { fontSize: 19, fontWeight: "700", color: colors.text },
  card: { backgroundColor: colors.surface, marginTop: 12 },
  lastCard: { marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  dangerText: { color: colors.danger },
  blockHint: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 18, paddingTop: 14 },
  sectionHeader: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" },
  emptyText: { fontSize: 13.5, color: colors.textFaint, paddingHorizontal: 18, paddingVertical: 14 },
  pinnedItem: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 12 },
  pinnedIcon: { marginTop: 3 },
  pinnedTextGroup: { flex: 1 },
  pinnedText: { fontSize: 14, color: colors.text },
  pinnedMeta: { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14 },
  mediaThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { flex: 1, fontSize: 14, color: colors.primary },
  footerNote: { fontSize: 12, color: colors.textFaint, textAlign: "center", paddingHorizontal: 24, marginTop: 20 },
});
