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
import { useTheme } from "../../src/context/ThemeContext";
import Avatar from "../../src/components/Avatar";
import { colors } from "../../src/constants/theme";
import type { User } from "../../src/types";

export default function NewGroupScreen() {
  const insets = useSafeAreaInsets();
  const { authUser } = useAuthContext();
  const { isDark } = useTheme();
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
      <View style={[styles.center, isDark && styles.darkSurface]}>
        <ActivityIndicator color={isDark ? "#a78bfa" : colors.primary} />
      </View>
    );
  }

  if (step === "details") {
    return (
      <KeyboardAvoidingView style={[styles.flex, isDark && styles.darkSurface]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.detailsContent}>
          <Text style={[styles.detailsLabel, isDark && styles.darkMutedText]}>Group name</Text>
          <TextInput
            style={[styles.nameInput, isDark && styles.darkInput]}
            placeholder="e.g. Weekend Plans"
            placeholderTextColor={isDark ? "#727c91" : colors.textFaint}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />

          <Text style={[styles.detailsLabel, isDark && styles.darkMutedText]}>
            {selectedUsers.length} {selectedUsers.length === 1 ? "member" : "members"}
          </Text>
          <View style={styles.chipWrap}>
            {selectedUsers.map((user) => (
              <View key={user._id} style={[styles.chip, isDark && styles.darkChip]}>
                <Avatar id={user._id} name={user.userName} uri={user.profilePic} gender={user.gender} size={22} />
                <Text style={[styles.chipText, isDark && styles.darkAccentText]}>{user.userName}</Text>
              </View>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={[styles.footer, isDark && styles.darkFooter, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep("members")}>
            <Text style={[styles.secondaryButtonText, isDark && styles.darkMutedText]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (submitting || !groupName.trim()) && styles.buttonDisabled, isDark && (submitting || !groupName.trim()) && styles.darkButtonDisabled]}
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
    <View style={[styles.flex, isDark && styles.darkSurface]}>
      <View style={[styles.searchWrapper, isDark && styles.darkInput]}>
        <Ionicons name="search" size={17} color={isDark ? "#727c91" : colors.textFaint} />
        <TextInput
          style={[styles.searchInput, isDark && styles.darkText]}
          placeholder="Search people"
          placeholderTextColor={isDark ? "#727c91" : colors.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={isDark ? styles.darkList : undefined}
        ItemSeparatorComponent={() => <View style={[styles.separator, isDark && styles.darkSeparator]} />}
        ListEmptyComponent={
          <View style={[styles.center, isDark && styles.darkSurface]}>
            <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>No people found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item._id);

          return (
            <TouchableOpacity style={[styles.row, isDark && styles.darkRow]} activeOpacity={0.6} onPress={() => toggleMember(item._id)}>
              <Avatar id={item._id} name={item.userName} uri={item.profilePic} gender={item.gender} size={44} />
              <Text style={[styles.rowName, isDark && styles.darkText]}>{item.userName}</Text>
              <View style={[styles.checkbox, isDark && styles.darkCheckbox, selected && styles.checkboxSelected]}>
                {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, isDark && styles.darkFooter, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Text style={[styles.footerCount, isDark && styles.darkMutedText]}>
          {selectedIds.length} selected
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, selectedIds.length === 0 && styles.buttonDisabled, isDark && selectedIds.length === 0 && styles.darkButtonDisabled]}
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
  darkSurface: { backgroundColor: "#050505" },
  darkText: { color: "#f3f5fa" },
  darkMutedText: { color: "#a5aec0" },
  darkAccentText: { color: "#a78bfa" },
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
  darkInput: { backgroundColor: "#0b0f1a", borderColor: "rgba(148, 163, 184, 0.2)", color: "#f3f5fa" },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 74 },
  darkSeparator: { backgroundColor: "rgba(148, 163, 184, 0.14)" },
  darkList: { backgroundColor: "#050505" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  darkRow: { backgroundColor: "#050505" },
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
  darkCheckbox: { borderColor: "#475569" },
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
  darkFooter: { backgroundColor: "#0b0f1a", borderTopColor: "rgba(148, 163, 184, 0.18)" },
  footerCount: { flex: 1, fontSize: 14, color: colors.textMuted },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  buttonDisabled: { backgroundColor: "rgba(99, 102, 241, 0.68)" },
  darkButtonDisabled: { backgroundColor: "rgba(99, 102, 241, 0.68)" },
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
  darkChip: { backgroundColor: "rgba(124, 58, 237, 0.22)" },
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
