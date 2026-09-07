import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listUsers } from "../../../src/api/users";
import { findOrCreateDirectConversation } from "../../../src/api/conversations";
import { useAuthContext } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";
import Avatar from "../../../src/components/Avatar";
import { colors } from "../../../src/constants/theme";
import type { User } from "../../../src/types";

export default function PeopleScreen() {
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const { isDark } = useTheme();
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
      router.push({ pathname: "/chat/[conversationId]", params: { conversationId } });
    } finally {
      setStartingWith(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, isDark && styles.darkSurface]}>
        <ActivityIndicator color={isDark ? "#a78bfa" : colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item._id}
      contentContainerStyle={[users.length === 0 ? styles.emptyContainer : styles.list, isDark && styles.darkList]}
      ItemSeparatorComponent={() => <View style={[styles.separator, isDark && styles.darkSeparator]} />}
      ListEmptyComponent={
        <View style={[styles.center, isDark && styles.darkSurface]}>
          <Ionicons name="people-outline" size={44} color={isDark ? "#727c91" : colors.textFaint} />
          <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>No other users yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, isDark && styles.darkRow]}
          activeOpacity={0.6}
          onPress={() => void handleSelect(item._id)}
          disabled={startingWith === item._id}
        >
          <Avatar id={item._id} name={item.userName} uri={item.profilePic} gender={item.gender} size={46} />
          <Text style={[styles.rowName, isDark && styles.darkText]}>{item.userName}</Text>
          {startingWith === item._id && <ActivityIndicator color={isDark ? "#a78bfa" : colors.primary} style={styles.rowSpinner} />}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  darkSurface: { backgroundColor: "#050505" },
  darkList: { backgroundColor: "#050505" },
  darkText: { color: "#f3f5fa" },
  darkMutedText: { color: "#a5aec0" },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  emptyContainer: { flexGrow: 1, backgroundColor: colors.surface },
  list: { flexGrow: 1, backgroundColor: colors.surface },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 78 },
  darkSeparator: { backgroundColor: "rgba(148, 163, 184, 0.14)" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  darkRow: { backgroundColor: "#050505" },
  rowName: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
  rowSpinner: { marginLeft: "auto" },
});
