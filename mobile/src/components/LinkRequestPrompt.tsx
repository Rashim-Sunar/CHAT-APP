import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDeviceLinkContext } from "../context/DeviceLinkContext";
import { colors } from "../constants/theme";

export default function LinkRequestPrompt() {
  const { incomingRequests, approveRequest, rejectRequest } = useDeviceLinkContext();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = incomingRequests[0];
  if (!request) return null;

  const run = async (action: "approve" | "reject") => {
    setBusy(action);
    setError(null);
    try {
      await (action === "approve" ? approveRequest(request.sessionId) : rejectRequest(request.sessionId));
    } catch {
      setError("Couldn't complete that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={26} color={colors.primary} />
          </View>

          <Text style={styles.title}>New device sign-in</Text>
          <Text style={styles.body}>
            {request.deviceInfo?.label || "A new device"} is trying to sign in to your account. Approve only if this
            is you — approving transfers your encryption key to that device.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.approveButton, busy !== null && styles.buttonDisabled]}
            onPress={() => void run("approve")}
            disabled={busy !== null}
          >
            {busy === "approve" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.approveButtonText}>Approve</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => void run("reject")}
            disabled={busy !== null}
          >
            <Text style={styles.rejectButtonText}>{busy === "reject" ? "Rejecting…" : "Not me"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: { width: "100%", backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: "center" },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginTop: 8 },
  error: { fontSize: 13, color: colors.danger, marginTop: 12 },
  approveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  approveButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  rejectButton: { marginTop: 10, paddingVertical: 10 },
  rejectButtonText: { color: colors.textMuted, fontWeight: "500", fontSize: 14 },
});
