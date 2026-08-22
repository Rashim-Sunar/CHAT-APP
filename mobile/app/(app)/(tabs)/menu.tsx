import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "../../../src/api/auth";
import { updateUserName, uploadProfilePicture } from "../../../src/api/users";
import { ApiFetchError } from "../../../src/api/client";
import { useAuthContext } from "../../../src/context/AuthContext";
import { useDeviceLinkContext } from "../../../src/context/DeviceLinkContext";
import Avatar from "../../../src/components/Avatar";
import { colors } from "../../../src/constants/theme";

export default function MenuScreen() {
  const { authUser, setAuthUser } = useAuthContext();
  const { backupEnabled, enableBackup } = useDeviceLinkContext();
  const user = authUser?.data?.user;

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user?.userName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

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

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to change your picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    setPhotoUploading(true);

    try {
      const updated = await uploadProfilePicture({
        uri: asset.uri,
        name: asset.fileName || `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setAuthUser({ status: "success", data: { user: updated } });
    } catch (uploadError: unknown) {
      Alert.alert(
        "Upload failed",
        uploadError instanceof Error ? uploadError.message : "Couldn't update your picture."
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleEnableBackup = async () => {
    if (backupPassword.length < 8) {
      setBackupError("Use at least 8 characters");
      return;
    }

    setBackupBusy(true);
    setBackupError(null);

    try {
      await enableBackup(backupPassword);
      setBackupOpen(false);
      setBackupPassword("");
      Alert.alert(
        "Backup enabled",
        "Keep this password safe — it's the only way to recover your messages if you lose access to all your devices."
      );
    } catch (enableError: unknown) {
      setBackupError(enableError instanceof ApiFetchError ? enableError.message : "Couldn't enable backup");
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => void handleChangePhoto()}
          disabled={photoUploading}
        >
          <Avatar id={user._id} name={user.userName} uri={user.profilePic} gender={user.gender} size={84} />
          <View style={styles.photoBadge}>
            {photoUploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

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
        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.6}
          disabled={backupEnabled}
          onPress={() => setBackupOpen(true)}
        >
          <Ionicons
            name={backupEnabled ? "shield-checkmark" : "shield-outline"}
            size={22}
            color={backupEnabled ? colors.online : colors.text}
          />
          <View style={styles.menuRowTextGroup}>
            <Text style={styles.menuRowText}>Encrypted key backup</Text>
            <Text style={styles.menuRowHint}>
              {backupEnabled
                ? "Enabled — you can recover with your password"
                : "Recover your messages if you lose every device"}
            </Text>
          </View>
          {!backupEnabled && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.6} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.menuRowTextDanger}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={backupOpen} transparent animationType="fade" onRequestClose={() => setBackupOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set a backup password</Text>
            <Text style={styles.modalBody}>
              Your private key is encrypted with this password before it&apos;s stored. We never see the password
              or your key — if you forget it, the backup can&apos;t be recovered.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Backup password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={backupPassword}
              onChangeText={setBackupPassword}
              autoFocus
            />

            {backupError && <Text style={styles.error}>{backupError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setBackupOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => void handleEnableBackup()}
                disabled={backupBusy}
              >
                <Text style={styles.modalSaveText}>{backupBusy ? "Saving…" : "Enable"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  photoBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  menuRowTextGroup: { flex: 1 },
  menuRowText: { fontSize: 15.5, fontWeight: "500", color: colors.text },
  menuRowHint: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  modalCard: { width: "100%", backgroundColor: colors.surface, borderRadius: 18, padding: 22 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  modalBody: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19, marginTop: 8 },
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
});
