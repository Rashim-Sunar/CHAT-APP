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
import { Ionicons } from "@expo/vector-icons";
import { signup } from "../../src/api/auth";
import { ApiFetchError } from "../../src/api/client";
import { useAuthContext } from "../../src/context/AuthContext";
import { colors } from "../../src/constants/theme";
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
      if (!response.data?.user?._id) {
        throw new Error("Signup response was missing user data");
      }

      setAuthUser(response);
    } catch (submitError: unknown) {
      setError(submitError instanceof ApiFetchError ? submitError.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Ionicons name="chatbubbles" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Your messages stay encrypted end-to-end, always.</Text>

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
            <Ionicons name="person-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textFaint}
              value={userName}
              onChangeText={setUserName}
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
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

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

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? "Creating account..." : "Sign up"}</Text>
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkTextStrong}>Log in</Text>
          </Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { flexGrow: 1, justifyContent: "center", padding: 28, paddingVertical: 40 },
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
  genderRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  genderChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderChipText: { color: colors.textMuted, fontWeight: "500", fontSize: 13.5 },
  genderChipTextSelected: { color: "#fff" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: colors.danger, fontSize: 13 },
  link: { alignItems: "center", marginTop: 24 },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkTextStrong: { color: colors.primary, fontWeight: "600" },
});
