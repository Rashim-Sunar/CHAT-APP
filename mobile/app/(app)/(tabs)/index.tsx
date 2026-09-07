import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { listConversations } from "../../../src/api/conversations";
import { useAuthContext } from "../../../src/context/AuthContext";
import { useSocketContext } from "../../../src/context/SocketContext";
import { useTheme } from "../../../src/context/ThemeContext";
import useConversationStore from "../../../src/store/useConversationStore";
import Avatar from "../../../src/components/Avatar";
import { colors } from "../../../src/constants/theme";
import { formatRelativeTime } from "../../../src/utils/formatTime";
import StoriesSection from "../../../src/components/stories/StoriesSection";

export default function ConversationListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const { onlineUsers } = useSocketContext();
  const conversations = useConversationStore((state) => state.conversations);
  const setConversations = useConversationStore((state) => state.setConversations);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(async () => {
    // Kept in the shared store rather than local state so the chat and
    // details screens can resolve participant info without re-fetching.
    setConversations(await listConversations(currentUserId, true));
  }, [setConversations, currentUserId]);

  useEffect(() => {
    void loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

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

  const handleNewChat = () => {
    setComposeMenuOpen(false);
    router.push("/people");
  };

  const handleNewGroup = () => {
    setComposeMenuOpen(false);
    router.push("/new-group");
  };

  const handleJoinGroup = () => {
    setComposeMenuOpen(false);
    router.push("/join-group");
  };

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.displayName.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [conversations, search]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setComposeMenuOpen(true)} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="create-outline" size={24} color={isDark ? "#a78bfa" : colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isDark]);

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Modal visible={composeMenuOpen} transparent animationType="fade" onRequestClose={() => setComposeMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setComposeMenuOpen(false)}>
          <View style={[styles.menuCard, isDark && styles.darkMenuCard, { marginTop: insets.top + 46 }]}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={handleNewChat}>
              <Ionicons name="chatbubble-outline" size={18} color={isDark ? "#f3f5fa" : colors.text} />
              <Text style={[styles.menuItemText, isDark && styles.darkText]}>New chat</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={handleNewGroup}>
              <Ionicons name="people-outline" size={18} color={isDark ? "#f3f5fa" : colors.text} />
              <Text style={[styles.menuItemText, isDark && styles.darkText]}>New group</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={handleJoinGroup}>
              <Ionicons name="link-outline" size={18} color={isDark ? "#f3f5fa" : colors.text} />
              <Text style={[styles.menuItemText, isDark && styles.darkText]}>Join with link</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, isDark && styles.darkSearchBox]}>
          <Text style={[styles.searchIcon, isDark && styles.darkMutedText]}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search chats"
            placeholderTextColor={isDark ? "#727c91" : colors.textFaint}
            style={[styles.searchInput, isDark && styles.darkText]}
          />
        </View>
      </View>

      <StoriesSection />

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[filteredConversations.length === 0 ? styles.emptyContainer : styles.list, isDark && styles.darkList]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, isDark && styles.darkSeparator]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={isDark ? "#727c91" : colors.textFaint} />
              <Text style={[styles.emptyTitle, isDark && styles.darkText]}>{search.trim() ? "No chats found" : "No conversations yet"}</Text>
              <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>{search.trim() ? "Try a different search term." : "Head to the People tab to start chatting."}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isGroup = item.type === "group";
          const otherParticipant = isGroup
            ? undefined
            : item.participants.find((participant) => participant._id !== currentUserId);
          const isOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));

          return (
            <TouchableOpacity
              style={[styles.row, isDark && styles.darkRow]}
              activeOpacity={0.6}
              onPress={() => router.push({ pathname: "/chat/[conversationId]", params: { conversationId: item._id } })}
            >
              <Avatar
                id={item._id}
                name={item.displayName}
                uri={item.displayAvatar}
                gender={otherParticipant?.gender}
                isGroup={isGroup}
                online={isOnline}
              />
              <View style={styles.rowText}>
                <View style={styles.rowTopLine}>
                    <Text style={[styles.rowName, isDark && styles.darkText]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  {Boolean(item.lastMessageAt) && (
                    <Text style={[styles.rowTime, isDark && styles.darkMutedText]}>{formatRelativeTime(item.lastMessageAt as string)}</Text>
                  )}
                </View>
                <View style={styles.rowBottomLine}>
                  <Text
                    style={[styles.rowPreview, Boolean(item.unreadCount) && styles.rowPreviewUnread, isDark && styles.darkMutedText, isDark && Boolean(item.unreadCount) && styles.darkText]}
                    numberOfLines={1}
                  >
                    {item.lastMessage
                      ? `${item.lastMessageSenderId === currentUserId ? "You" : item.participants.find((participant) => participant._id === item.lastMessageSenderId)?.userName || item.displayName}: ${item.lastMessage}`
                      : "Say hello \u{1F44B}"}
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
  darkContainer: { backgroundColor: "#050505" },
  darkText: { color: "#f3f5fa" },
  darkMutedText: { color: "#a5aec0" },
  headerButton: { padding: 2, marginRight: 4 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  darkSearchBox: { backgroundColor: "#0b0f1a", borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.18)" },
  searchIcon: { color: colors.textFaint, fontSize: 18, marginTop: -1 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  backdrop: { flex: 1, alignItems: "flex-end" },
  menuCard: {
    marginRight: 12,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  darkMenuCard: { backgroundColor: "#111827", shadowColor: "#000" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontSize: 15, color: colors.text, fontWeight: "500" },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 12 },
  list: { flexGrow: 1 },
  darkList: { backgroundColor: "#050505" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 78 },
  darkSeparator: { backgroundColor: "rgba(148, 163, 184, 0.14)" },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingTop: 120, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  darkRow: { backgroundColor: "#050505" },
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
