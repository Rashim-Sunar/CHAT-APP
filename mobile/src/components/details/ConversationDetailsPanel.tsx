import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getPinnedMessages,
  getSharedContent,
  listConversations,
  setConversationMuted,
  setUserBlocked,
} from "../../api/conversations";
import {
  createInviteLink,
  leaveGroupConversation,
  promoteGroupAdmin,
  removeGroupMember,
  revokeInviteLink,
  updateGroupConversation,
} from "../../api/groups";
import { decryptMessagesIfNeeded } from "../../crypto/crypto";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";
import useConversationStore from "../../store/useConversationStore";
import Avatar from "../Avatar";
import { colors } from "../../constants/theme";
import { formatRelativeTime } from "../../utils/formatTime";
import type { Message, SharedContentResponse } from "../../types";

const EMPTY_SHARED_CONTENT: SharedContentResponse = { media: [], links: [], documents: [] };

interface ConversationDetailsPanelProps {
  conversationId: string;
  onClose: () => void;
}

export default function ConversationDetailsPanel({
  conversationId,
  onClose,
}: ConversationDetailsPanelProps) {
  const { authUser } = useAuthContext();
  const { onlineUsers } = useSocketContext();
  const currentUserId = authUser?.data?.user?._id as string;

  const conversation = useConversationStore((state) =>
    state.conversations.find((item) => item._id === conversationId)
  );
  const setConversations = useConversationStore((state) => state.setConversations);

  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [sharedContent, setSharedContent] = useState<SharedContentResponse>(EMPTY_SHARED_CONTENT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getPinnedMessages(conversationId), getSharedContent(conversationId)])
      .then(async ([pinned, shared]) => {
        const decryptedPinned = await decryptMessagesIfNeeded(pinned, currentUserId);
        if (cancelled) return;
        setPinnedMessages(decryptedPinned);
        setSharedContent(shared);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUserId]);

  // Mute/block/membership flags live on the conversation summary rather than a
  // single-conversation endpoint, so actions refetch the list.
  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, [setConversations]);

  const runAction = async (action: () => Promise<unknown>, failureMessage: string) => {
    setBusy(true);
    try {
      await action();
      await refreshConversations();
    } catch {
      Alert.alert("Something went wrong", failureMessage);
    } finally {
      setBusy(false);
    }
  };

  if (!conversation) return null;

  const isGroup = conversation.type === "group";
  const otherParticipant = conversation.participants.find((participant) => participant._id !== currentUserId);
  const isMuted = Boolean(conversation.isMuted);
  const isBlocked = Boolean(conversation.isBlocked);
  const blockedByMe = Boolean(conversation.blockedByMe);
  const isAdmin = conversation.participants.some(
    (participant) => participant._id === currentUserId && participant.isAdmin
  );

  const openRename = () => {
    setRenameDraft(conversation.displayName);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const trimmed = renameDraft.trim();
    if (!trimmed) return;

    setRenameOpen(false);
    await runAction(
      () => updateGroupConversation(conversationId, { groupName: trimmed }),
      "Couldn't rename group."
    );
  };

  const handleInviteLink = async () => {
    setBusy(true);
    try {
      const inviteUrl = await createInviteLink(conversationId);
      await Share.share({ message: `Join my group on ChatApp: ${inviteUrl}` });
    } catch {
      Alert.alert("Something went wrong", "Couldn't create an invite link.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeInvite = () => {
    Alert.alert("Revoke invite link", "Existing links will stop working.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () => void runAction(() => revokeInviteLink(conversationId), "Couldn't revoke the link."),
      },
    ]);
  };

  const handleMemberActions = (memberId: string, memberName: string, memberIsAdmin: boolean) => {
    if (!isGroup || !isAdmin || memberId === currentUserId) return;

    const options = [
      !memberIsAdmin && {
        text: "Make admin",
        onPress: () =>
          void runAction(() => promoteGroupAdmin(conversationId, memberId), "Couldn't promote this member."),
      },
      {
        text: "Remove from group",
        style: "destructive" as const,
        onPress: () =>
          void runAction(() => removeGroupMember(conversationId, memberId), "Couldn't remove this member."),
      },
      { text: "Cancel", style: "cancel" as const },
    ].filter(Boolean) as { text: string; style?: "destructive" | "cancel"; onPress?: () => void }[];

    Alert.alert(memberName, undefined, options);
  };

  const handleLeaveGroup = () => {
    Alert.alert("Leave group", "You'll stop receiving messages from this group.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await runAction(() => leaveGroupConversation(conversationId), "Couldn't leave the group.");
            onClose();
            router.dismissAll();
          })();
        },
      },
    ]);
  };

  const handleToggleBlock = (nextBlocked: boolean) => {
    void runAction(() => setUserBlocked(conversationId, nextBlocked), "Couldn't update block status.");
  };

  return (
    <View style={styles.flex}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelHeaderTitle}>Details</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename group</Text>
            <TextInput
              style={styles.modalInput}
              value={renameDraft}
              onChangeText={setRenameDraft}
              autoFocus
              placeholder="Group name"
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setRenameOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => void submitRename()}
                disabled={!renameDraft.trim()}
              >
                <Text style={[styles.modalSaveText, !renameDraft.trim() && styles.modalSaveDisabled]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.profileSection}>
        <Avatar
          id={isGroup ? conversation._id : otherParticipant?._id || conversation._id}
          name={conversation.displayName}
          uri={conversation.displayAvatar}
          gender={isGroup ? undefined : otherParticipant?.gender}
          isGroup={isGroup}
          size={88}
        />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{conversation.displayName}</Text>
          {isGroup && isAdmin && (
            <TouchableOpacity onPress={openRename} hitSlop={8} disabled={busy}>
              <Ionicons name="pencil" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        {isGroup && <Text style={styles.subtitle}>{conversation.participants.length} members</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="notifications-off-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowLabel}>Mute notifications</Text>
          <Switch
            value={isMuted}
            onValueChange={(next) =>
              void runAction(() => setConversationMuted(conversationId, next), "Couldn't update mute setting.")
            }
            disabled={busy}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={isMuted ? colors.primary : "#fff"}
          />
        </View>
      </View>

      {isGroup ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
          </View>
          <View style={styles.card}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/chat/[conversationId]/add-members", params: { conversationId } });
                }}
              >
                <View style={styles.addIcon}>
                  <Ionicons name="person-add" size={17} color={colors.primary} />
                </View>
                <Text style={[styles.rowLabel, styles.primaryText]}>Add members</Text>
              </TouchableOpacity>
            )}

            {conversation.participants.map((participant) => (
              <TouchableOpacity
                key={participant._id}
                style={styles.row}
                activeOpacity={isAdmin && participant._id !== currentUserId ? 0.6 : 1}
                onPress={() =>
                  handleMemberActions(participant._id, participant.userName, Boolean(participant.isAdmin))
                }
              >
                <Avatar
                  id={participant._id}
                  name={participant.userName}
                  uri={participant.profilePic}
                  gender={participant.gender}
                  size={40}
                  online={onlineUsers.includes(participant._id)}
                />
                <Text style={styles.rowLabel}>
                  {participant._id === currentUserId ? "You" : participant.userName}
                </Text>
                {participant.isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {isAdmin && (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                disabled={busy}
                onPress={() => void handleInviteLink()}
              >
                <Ionicons name="link-outline" size={20} color={colors.primary} />
                <Text style={[styles.rowLabel, styles.primaryText]}>Share invite link</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} activeOpacity={0.6} disabled={busy} onPress={handleRevokeInvite}>
                <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                <Text style={styles.rowLabel}>Revoke invite link</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            <TouchableOpacity style={styles.row} activeOpacity={0.6} disabled={busy} onPress={handleLeaveGroup}>
              <Ionicons name="exit-outline" size={20} color={colors.danger} />
              <Text style={[styles.rowLabel, styles.dangerText]}>Leave group</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          {blockedByMe && (
            <Text style={styles.blockHint}>You blocked this contact. Unblock to send and receive messages.</Text>
          )}
          {isBlocked && !blockedByMe && (
            <Text style={styles.blockHint}>This contact has blocked you. You can&apos;t message right now.</Text>
          )}
          {(!isBlocked || blockedByMe) && (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              disabled={busy}
              onPress={() => handleToggleBlock(!blockedByMe)}
            >
              <Ionicons name="ban-outline" size={20} color={colors.danger} />
              <Text style={[styles.rowLabel, styles.dangerText]}>
                {blockedByMe ? "Unblock contact" : "Block contact"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
      <View style={styles.card}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  panelHeaderTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  content: { paddingBottom: 40 },
  profileSection: { alignItems: "center", backgroundColor: colors.surface, paddingVertical: 28, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  name: { fontSize: 19, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13.5, color: colors.textMuted },
  card: { backgroundColor: colors.surface, marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  primaryText: { color: colors.primary, fontWeight: "500" },
  dangerText: { color: colors.danger },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  adminBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  modalCard: { width: "100%", backgroundColor: colors.surface, borderRadius: 18, padding: 22 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15.5,
    color: colors.text,
    marginTop: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 9 },
  modalCancelText: { fontSize: 15, color: colors.textMuted, fontWeight: "500" },
  modalSaveText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  modalSaveDisabled: { color: colors.textFaint },
});
