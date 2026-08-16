import { useState } from "react";
import { Link } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { login } from "../../src/api/auth";
import { ApiFetchError } from "../../src/api/client";
import { ensureUserKeyPair } from "../../src/crypto/crypto";
import { useAuthContext } from "../../src/context/AuthContext";

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Log in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting || !email || !password}
      >
        <Text style={styles.buttonText}>{submitting ? "Logging in..." : "Log in"}</Text>
      </TouchableOpacity>

      <Link href="/(auth)/signup" style={styles.link}>
        <Text style={styles.linkText}>Don&apos;t have an account? Sign up</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#dc2626", fontSize: 13 },
  link: { alignItems: "center", marginTop: 16 },
  linkText: { color: "#4f46e5", fontWeight: "500" },
});
