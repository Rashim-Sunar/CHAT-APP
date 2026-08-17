import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listConversations } from "../../src/api/conversations";
import { logout } from "../../src/api/auth";
import { useAuthContext } from "../../src/context/AuthContext";
import { useSocketContext } from "../../src/context/SocketContext";
import useListenMessages from "../../src/hooks/useListenMessages";
import useConversationStore from "../../src/store/useConversationStore";
import Avatar from "../../src/components/Avatar";
import { colors } from "../../src/constants/theme";
import { formatRelativeTime } from "../../src/utils/formatTime";

export default function ConversationListScreen() {
  const navigation = useNavigation();
  const { authUser, setAuthUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const { onlineUsers } = useSocketContext();
  const conversations = useConversationStore((state) => state.conversations);
  const setConversations = useConversationStore((state) => state.setConversations);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    const all = await listConversations();
    // Phase 1 is direct-messaging only; group conversations may still come
    // back from the API (group creation isn't gated by client version) but
    // aren't rendered here. Kept in the shared store (not local state) so
    // the chat screen can resolve participant info without re-fetching.
    setConversations(all.filter((conversation) => conversation.type === "direct"));
  }, [setConversations]);

  useEffect(() => {
    void loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Socket newMessage events update the message store; re-pull the
  // conversation list (for preview/ordering) whenever one arrives — simpler
  // than porting the web app's optimistic in-place reordering for phase 1.
  useListenMessages(loadConversations);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout().catch(() => {
      // Even if the request fails, drop local session state below.
    });
    setAuthUser(null);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push("/new-chat")} hitSlop={10} style={styles.headerButton}>
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void handleLogout()} hitSlop={10} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>Tap the compose icon above to start chatting.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const otherParticipant = item.participants.find((participant) => participant._id !== currentUserId);
          const isOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));

          return (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => router.push({ pathname: "/chat/[conversationId]", params: { conversationId: item._id } })}
          >
            <Avatar id={item._id} name={item.displayName} uri={item.displayAvatar} online={isOnline} />
            <View style={styles.rowText}>
              <View style={styles.rowTopLine}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {Boolean(item.lastMessageAt) && (
                  <Text style={styles.rowTime}>{formatRelativeTime(item.lastMessageAt as string)}</Text>
                )}
              </View>
              <View style={styles.rowBottomLine}>
                <Text
                  style={[styles.rowPreview, Boolean(item.unreadCount) && styles.rowPreviewUnread]}
                  numberOfLines={1}
                >
                  {item.lastMessage || "Say hello \u{1F44B}"}
                </Text>
                {Boolean(item.unreadCount) && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18, marginRight: 4 },
  headerButton: { padding: 2 },
  list: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 78 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingTop: 120, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 3 },
  rowTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontSize: 16, fontWeight: "600", color: colors.text, flexShrink: 1 },
  rowTime: { fontSize: 12, color: colors.textFaint, marginLeft: 8 },
  rowBottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPreview: { fontSize: 14, color: colors.textMuted, flex: 1 },
  rowPreviewUnread: { color: colors.text, fontWeight: "500" },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
