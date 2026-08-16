import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { listUsers } from "../../src/api/users";
import { findOrCreateDirectConversation } from "../../src/api/conversations";
import { useAuthContext } from "../../src/context/AuthContext";
import type { User } from "../../src/types";

export default function NewChatScreen() {
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingWith, setStartingWith] = useState<string | null>(null);

  useEffect(() => {
    void listUsers()
      .then((all) => setUsers(all.filter((user) => user._id !== currentUserId)))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const handleSelect = async (userId: string) => {
    setStartingWith(userId);
    try {
      const conversationId = await findOrCreateDirectConversation(userId);
      router.replace({ pathname: "/chat/[conversationId]", params: { conversationId } });
    } finally {
      setStartingWith(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No other users yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => void handleSelect(item._id)}
          disabled={startingWith === item._id}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.userName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.rowName}>{item.userName}</Text>
          {startingWith === item._id && <ActivityIndicator style={styles.rowSpinner} />}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: "#6b7280" },
  list: { flexGrow: 1 },
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
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#4338ca", fontWeight: "700" },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500" },
  rowSpinner: { marginLeft: "auto" },
});
