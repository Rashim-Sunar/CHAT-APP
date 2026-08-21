import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { listUsers } from "../../src/api/users";
import { createGroupConversation } from "../../src/api/groups";
import { ApiFetchError } from "../../src/api/client";
import { useAuthContext } from "../../src/context/AuthContext";
import Avatar from "../../src/components/Avatar";
import { colors } from "../../src/constants/theme";
import type { User } from "../../src/types";

export default function NewGroupScreen() {
  const insets = useSafeAreaInsets();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const [step, setStep] = useState<"members" | "details">("members");
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listUsers()
      .then((all) => setUsers(all.filter((user) => user._id !== currentUserId)))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => user.userName.toLowerCase().includes(query));
  }, [users, search]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user._id)),
    [users, selectedIds]
  );

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setError("Give your group a name");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const conversationId = await createGroupConversation(trimmedName, selectedIds);
      router.replace({ pathname: "/chat/[conversationId]", params: { conversationId } });
    } catch (createError: unknown) {
      setError(createError instanceof ApiFetchError ? createError.message : "Failed to create group");
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

  if (step === "details") {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.detailsContent}>
          <Text style={styles.detailsLabel}>Group name</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="e.g. Weekend Plans"
            placeholderTextColor={colors.textFaint}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />

          <Text style={styles.detailsLabel}>
            {selectedUsers.length} {selectedUsers.length === 1 ? "member" : "members"}
          </Text>
          <View style={styles.chipWrap}>
            {selectedUsers.map((user) => (
              <View key={user._id} style={styles.chip}>
                <Avatar id={user._id} name={user.userName} uri={user.profilePic} gender={user.gender} size={22} />
                <Text style={styles.chipText}>{user.userName}</Text>
              </View>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep("members")}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (submitting || !groupName.trim()) && styles.buttonDisabled]}
            onPress={() => void handleCreate()}
            disabled={submitting || !groupName.trim()}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Creating…" : "Create group"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
            <Text style={styles.emptyText}>No people found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item._id);

          return (
            <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => toggleMember(item._id)}>
              <Avatar id={item._id} name={item.userName} uri={item.profilePic} gender={item.gender} size={44} />
              <Text style={styles.rowName}>{item.userName}</Text>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Text style={styles.footerCount}>
          {selectedIds.length} selected
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, selectedIds.length === 0 && styles.buttonDisabled]}
          onPress={() => setStep("details")}
          disabled={selectedIds.length === 0}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
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
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secondaryButton: { paddingHorizontal: 18, paddingVertical: 13 },
  secondaryButtonText: { color: colors.textMuted, fontWeight: "500", fontSize: 15 },
  detailsContent: { flex: 1, padding: 20, gap: 10 },
  detailsLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", marginTop: 8 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  chipText: { fontSize: 13, color: colors.primaryDark, fontWeight: "500" },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
});
