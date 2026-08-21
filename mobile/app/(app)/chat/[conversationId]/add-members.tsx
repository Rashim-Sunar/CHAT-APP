import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { listUsers } from "../../../../src/api/users";
import { listConversations } from "../../../../src/api/conversations";
import { addGroupMembers } from "../../../../src/api/groups";
import { ApiFetchError } from "../../../../src/api/client";
import useConversationStore from "../../../../src/store/useConversationStore";
import Avatar from "../../../../src/components/Avatar";
import { colors } from "../../../../src/constants/theme";
import type { User } from "../../../../src/types";

export default function AddMembersScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const insets = useSafeAreaInsets();

  const conversation = useConversationStore((state) =>
    state.conversations.find((item) => item._id === conversationId)
  );
  const setConversations = useConversationStore((state) => state.setConversations);

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingMemberIds = useMemo(
    () => new Set((conversation?.participants || []).map((participant) => participant._id)),
    [conversation]
  );

  useEffect(() => {
    void listUsers()
      .then((all) => setUsers(all.filter((user) => !existingMemberIds.has(user._id))))
      .finally(() => setLoading(false));
  }, [existingMemberIds]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => user.userName.toLowerCase().includes(query));
  }, [users, search]);

  const handleAdd = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await addGroupMembers(conversationId, selectedIds);
      setConversations(await listConversations());
      router.back();
    } catch (addError: unknown) {
      setError(addError instanceof ApiFetchError ? addError.message : "Failed to add members");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people"
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item._id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>Everyone is already in this group.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item._id);

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
              <Avatar id={item._id} name={item.userName} uri={item.profilePic} gender={item.gender} size={44} />
              <Text style={styles.rowName}>{item.userName}</Text>
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
          style={[styles.primaryButton, (submitting || selectedIds.length === 0) && styles.buttonDisabled]}
          onPress={() => void handleAdd()}
          disabled={submitting || selectedIds.length === 0}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Adding…" : "Add"}</Text>
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
  primaryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
