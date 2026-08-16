import { useState } from "react";
import { Link } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { signup } from "../../src/api/auth";
import { ApiFetchError } from "../../src/api/client";
import { ensureUserKeyPair } from "../../src/crypto/crypto";
import { useAuthContext } from "../../src/context/AuthContext";
import type { Gender } from "../../src/types";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "others", label: "Other" },
];

export default function SignupScreen() {
  const { setAuthUser } = useAuthContext();
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (userName.trim().length < 5) {
      setError("Username must be at least 5 characters");
      return;
    }
    if (password.length < 5) {
      setError("Password must be at least 5 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!gender) {
      setError("Select a gender");
      return;
    }

    setSubmitting(true);

    try {
      const response = await signup({
        email: email.trim(),
        userName: userName.trim(),
        password,
        confirmPassword,
        gender,
      });
      const userId = response.data?.user?._id;
      if (!userId) {
        throw new Error("Signup response was missing user data");
      }

      await ensureUserKeyPair(userId);
      setAuthUser(response);
    } catch (submitError: unknown) {
      setError(submitError instanceof ApiFetchError ? submitError.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sign up</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput style={styles.input} placeholder="Username" value={userName} onChangeText={setUserName} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.genderChip, gender === option.value && styles.genderChipSelected]}
              onPress={() => setGender(option.value)}
            >
              <Text style={[styles.genderChipText, gender === option.value && styles.genderChipTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Creating account..." : "Sign up"}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  genderChipSelected: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  genderChipText: { color: "#374151", fontWeight: "500" },
  genderChipTextSelected: { color: "#fff" },
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
