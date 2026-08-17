import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "../../../src/api/auth";
import { updateUserName } from "../../../src/api/users";
import { ApiFetchError } from "../../../src/api/client";
import { useAuthContext } from "../../../src/context/AuthContext";
import Avatar from "../../../src/components/Avatar";
import { colors } from "../../../src/constants/theme";

export default function MenuScreen() {
  const { authUser, setAuthUser } = useAuthContext();
  const user = authUser?.data?.user;

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user?.userName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const startEditing = () => {
    setDraftName(user.userName);
    setError(null);
    setEditing(true);
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length < 5) {
      setError("Username must be at least 5 characters");
      return;
    }
    if (trimmed === user.userName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateUserName(trimmed);
      setAuthUser({ status: "success", data: { user: updated } });
      setEditing(false);
    } catch (submitError: unknown) {
      setError(submitError instanceof ApiFetchError ? submitError.message : "Failed to update username");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {
      // Even if the request fails, drop local session state below.
    });
    setAuthUser(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <Avatar id={user._id} name={user.userName} uri={user.profilePic} gender={user.gender} size={84} />

        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => void handleSaveName()} disabled={saving} hitSlop={8}>
              <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)} disabled={saving} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color={colors.textFaint} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={startEditing} activeOpacity={0.6}>
            <Text style={styles.name}>{user.userName}</Text>
            <Ionicons name="pencil" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.genderChip}>
          <Text style={styles.genderChipText}>{user.gender}</Text>
        </View>
      </View>

      <View style={styles.menuList}>
        <TouchableOpacity style={styles.menuRow} activeOpacity={0.6} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.menuRowTextDanger}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  editRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, width: "100%" },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 12.5 },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  genderChip: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  genderChipText: { fontSize: 12, fontWeight: "600", color: colors.primary, textTransform: "capitalize" },
  menuList: { marginTop: 12 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowTextDanger: { fontSize: 15.5, fontWeight: "500", color: colors.danger },
});
