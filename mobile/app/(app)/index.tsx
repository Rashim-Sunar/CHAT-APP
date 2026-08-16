import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { listConversations } from "../../src/api/conversations";
import { logout } from "../../src/api/auth";
import { useAuthContext } from "../../src/context/AuthContext";
import useListenMessages from "../../src/hooks/useListenMessages";
import useConversationStore from "../../src/store/useConversationStore";

export default function ConversationListScreen() {
  const { setAuthUser } = useAuthContext();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/new-chat")}>
          <Text style={styles.headerAction}>New chat</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleLogout()}>
          <Text style={styles.headerAction}>Log out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No conversations yet — start one with "New chat".</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: "/chat/[conversationId]", params: { conversationId: item._id } })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{item.displayName}</Text>
              <Text style={styles.rowPreview} numberOfLines={1}>
                {item.lastMessage || "Say hello"}
              </Text>
            </View>
            {Boolean(item.unreadCount) && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerAction: { color: "#4f46e5", fontWeight: "600" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#6b7280", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#4338ca", fontWeight: "700", fontSize: 16 },
  rowText: { flex: 1 },
  rowName: { fontWeight: "600", fontSize: 15 },
  rowPreview: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
