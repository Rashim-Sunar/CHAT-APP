import { useState } from "react";
import { Link } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { login } from "../../src/api/auth";
import { ApiFetchError } from "../../src/api/client";
import { ensureUserKeyPair } from "../../src/crypto/crypto";
import { useAuthContext } from "../../src/context/AuthContext";
import { colors } from "../../src/constants/theme";

export default function LoginScreen() {
  const { setAuthUser } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const response = await login({ email: email.trim(), password });
      const userId = response.data?.user?._id;
      if (!userId) {
        throw new Error("Login response was missing user data");
      }

      // Generates a local keypair on first login from this device, or
      // re-syncs the public key if one already exists — no device-linking
      // gate in phase 1, always fresh-local-key.
      await ensureUserKeyPair(userId);

      // Once this updates, the root layout's Stack.Protected guard switches
      // to the (app) group automatically — no manual navigation needed.
      setAuthUser(response);
    } catch (submitError: unknown) {
      setError(submitError instanceof ApiFetchError ? submitError.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={styles.brandMark}>
          <Ionicons name="chatbubbles" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to keep your conversations end-to-end encrypted.</Text>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, (submitting || !email || !password) && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting || !email || !password}
          >
            <Text style={styles.buttonText}>{submitting ? "Logging in..." : "Log in"}</Text>
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/signup" style={styles.link}>
          <Text style={styles.linkText}>
            Don&apos;t have an account? <Text style={styles.linkTextStrong}>Sign up</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, justifyContent: "center", padding: 28 },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 28, lineHeight: 20 },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: colors.danger, fontSize: 13 },
  link: { alignItems: "center", marginTop: 24 },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkTextStrong: { color: colors.primary, fontWeight: "600" },
});
