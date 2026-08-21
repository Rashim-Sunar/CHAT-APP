import { useState } from "react";
import { router } from "expo-router";
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
import {
  extractInviteToken,
  joinByInviteLink,
  previewInviteLink,
  type InvitePreview,
} from "../../src/api/groups";
import { listConversations } from "../../src/api/conversations";
import useConversationStore from "../../src/store/useConversationStore";
import Avatar from "../../src/components/Avatar";
import { colors } from "../../src/constants/theme";

export default function JoinGroupScreen() {
  const setConversations = useConversationStore((state) => state.setConversations);

  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    const nextToken = extractInviteToken(input);
    if (!nextToken) return;

    setBusy(true);
    setError(null);

    try {
      const result = await previewInviteLink(nextToken);
      setToken(nextToken);
      setPreview(result);
    } catch (previewError: unknown) {
      setError(previewError instanceof Error ? previewError.message : "Couldn't read that invite");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);

    try {
      const conversationId = await joinByInviteLink(token);
      setConversations(await listConversations());
      router.replace({ pathname: "/chat/[conversationId]", params: { conversationId } });
    } catch (joinError: unknown) {
      setError(joinError instanceof Error ? joinError.message : "Couldn't join this group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {preview ? (
        <View style={styles.previewCard}>
          <Avatar id={token} name={preview.groupName} uri={preview.groupAvatar} isGroup size={80} />
          <Text style={styles.groupName}>{preview.groupName}</Text>
          <Text style={styles.memberCount}>{preview.memberCount} members</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={() => void handleJoin()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Join group</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setPreview(null);
              setError(null);
            }}
          >
            <Text style={styles.secondaryButtonText}>Use a different link</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.iconCircle}>
            <Ionicons name="link" size={28} color={colors.primary} />
          </View>

          <Text style={styles.title}>Join with an invite link</Text>
          <Text style={styles.body}>Paste the invite link someone shared with you.</Text>

          <TextInput
            style={styles.input}
            placeholder="https://…/join/abc123"
            placeholderTextColor={colors.textFaint}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, (busy || !input.trim()) && styles.buttonDisabled]}
            onPress={() => void handlePreview()}
            disabled={busy || !input.trim()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, justifyContent: "center", paddingHorizontal: 28 },
  form: { alignItems: "center" },
  previewCard: { alignItems: "center" },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 21, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { fontSize: 14.5, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  groupName: { fontSize: 21, fontWeight: "700", color: colors.text, marginTop: 18 },
  memberCount: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
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
  error: { color: colors.danger, fontSize: 13, textAlign: "center", marginTop: 14 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 22,
  },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15.5 },
  secondaryButton: { marginTop: 14, paddingVertical: 10 },
  secondaryButtonText: { color: colors.textMuted, fontWeight: "500", fontSize: 14 },
});
