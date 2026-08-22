import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthContext } from "../context/AuthContext";
import { useDeviceLinkContext } from "../context/DeviceLinkContext";
import { logout } from "../api/auth";
import { colors } from "../constants/theme";

const STATUS_COPY = {
  pending: {
    icon: "hourglass-outline" as const,
    title: "Waiting for approval",
    body: "Open ChatApp on a device you already use and approve this login to transfer your encryption key.",
  },
  rejected: {
    icon: "close-circle-outline" as const,
    title: "Request rejected",
    body: "Your other device declined this login. You can send a new request.",
  },
  expired: {
    icon: "time-outline" as const,
    title: "Request expired",
    body: "The approval window closed before your other device responded.",
  },
  error: {
    icon: "alert-circle-outline" as const,
    title: "Something went wrong",
    body: "We couldn't finish setting up secure messaging on this device.",
  },
  needs_restore: {
    icon: "lock-closed-outline" as const,
    title: "Link this device",
    body: "Your messages are end-to-end encrypted, so this device needs the key from a device you already use. Approve the request there to finish.",
  },
};

export default function DeviceLinkGate() {
  const { status, error, isLinking, backupEnabled, startDeviceLinking, restoreFromBackup } =
    useDeviceLinkContext();
  const { setAuthUser } = useAuthContext();

  const [showPasswordRestore, setShowPasswordRestore] = useState(false);
  const [password, setPassword] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setAuthUser(null);
  };

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreError(null);

    try {
      await restoreFromBackup(password);
    } catch (error: unknown) {
      setRestoreError(error instanceof Error ? error.message : "Couldn't restore from backup");
    } finally {
      setRestoring(false);
    }
  };

  if (status === "checking") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const copy = STATUS_COPY[status as keyof typeof STATUS_COPY] ?? STATUS_COPY.needs_restore;
  const canRetry = status !== "pending";

  if (showPasswordRestore) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={30} color={colors.primary} />
        </View>

        <Text style={styles.title}>Enter backup password</Text>
        <Text style={styles.body}>
          This unlocks the encrypted key backup you set up earlier. It never leaves this device.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Backup password"
          placeholderTextColor={colors.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
        />

        {restoreError && <Text style={styles.error}>{restoreError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, (restoring || !password) && styles.buttonDisabled]}
          onPress={() => void handleRestore()}
          disabled={restoring || !password}
        >
          <Text style={styles.primaryButtonText}>{restoring ? "Restoring…" : "Restore access"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPasswordRestore(false)}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        {status === "pending" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name={copy.icon} size={30} color={colors.primary} />
        )}
      </View>

      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      {error && status !== "needs_restore" && <Text style={styles.error}>{error}</Text>}

      {canRetry && (
        <TouchableOpacity
          style={[styles.primaryButton, isLinking && styles.buttonDisabled]}
          onPress={() => void startDeviceLinking()}
          disabled={isLinking}
        >
          <Text style={styles.primaryButtonText}>
            {isLinking ? "Sending request…" : status === "needs_restore" ? "Send approval request" : "Try again"}
          </Text>
        </TouchableOpacity>
      )}

      {backupEnabled && (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPasswordRestore(true)}>
          <Text style={styles.linkText}>Use backup password instead</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleLogout()}>
        <Text style={styles.secondaryButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  title: { fontSize: 21, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { fontSize: 14.5, color: colors.textMuted, textAlign: "center", lineHeight: 21, marginTop: 10 },
  error: { fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 14 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15.5 },
  secondaryButton: { marginTop: 16, paddingVertical: 10 },
  secondaryButtonText: { color: colors.textMuted, fontWeight: "500", fontSize: 14 },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    marginTop: 24,
  },
});
