// Spike 1 (see plan): confirms POST /api/auth/login's Set-Cookie is later
// replayed automatically on a plain fetch('/api/auth/me') call, on this
// Expo SDK's actual fetch implementation, on a real device/simulator —
// NOT something to assume works. Deliberately does not attach any manual
// Cookie header anywhere; if /auth/me succeeds after login with zero manual
// cookie handling, the plan's primary approach is safe to build on. If it
// 401s, switch to the documented fallback (fetch-cookie) before building
// the real API client.
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { assertApiBaseUrl } from "../src/config/env";

type StepResult = { label: string; ok: boolean; detail: string };

export default function SpikeCookieScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const runStep = async (label: string, action: () => Promise<{ ok: boolean; detail: string }>) => {
    try {
      const result = await action();
      setSteps((prev) => [...prev, { label, ...result }]);
      return result.ok;
    } catch (error: unknown) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setSteps((prev) => [...prev, { label, ok: false, detail: message }]);
      return false;
    }
  };

  const handleRun = async () => {
    setSteps([]);
    setRunning(true);

    try {
      const baseUrl = assertApiBaseUrl();

      const loginOk = await runStep("1. POST /auth/login", async () => {
        const response = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await response.json().catch(() => null);
        const setCookieHeader = response.headers.get("set-cookie");
        return {
          ok: response.ok && body?.status === "success",
          detail: `HTTP ${response.status} — Set-Cookie header visible to JS: ${
            setCookieHeader ? "yes" : "no (this is fine — it just means the platform hid it, not that it failed to persist)"
          }`,
        };
      });

      if (!loginOk) {
        setRunning(false);
        return;
      }

      // Deliberately a completely separate fetch call, no manual cookie
      // handling of any kind — this is exactly what a real app reload does.
      await runStep("2. GET /auth/me (no manual cookie attached)", async () => {
        const response = await fetch(`${baseUrl}/auth/me`);
        const body = await response.json().catch(() => null);
        const authenticated = response.ok && body?.status === "success" && Boolean(body?.data?.user?._id);
        return {
          ok: authenticated,
          detail: authenticated
            ? `Authenticated as ${body.data.user.userName} — cookie persisted automatically. Safe to build the real API client on this.`
            : `HTTP ${response.status} — cookie was NOT replayed. Switch to the fetch-cookie fallback (see plan) before building further.`,
        };
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Spike 1 — cookie persistence</Text>
      <Text style={styles.subtitle}>
        Uses an existing account on the real backend. No manual cookie handling anywhere in this screen —
        that's the whole point of the test.
      </Text>

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

      <TouchableOpacity style={styles.button} onPress={handleRun} disabled={running || !email || !password}>
        <Text style={styles.buttonText}>{running ? "Running..." : "Run spike test"}</Text>
      </TouchableOpacity>

      {steps.map((step, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.status, step.ok ? styles.pass : styles.fail]}>{step.ok ? "PASS" : "FAIL"}</Text>
          <View style={styles.rowText}>
            <Text style={styles.label}>{step.label}</Text>
            <Text style={styles.detail}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rowText: { flex: 1 },
  status: { fontWeight: "700", width: 44 },
  pass: { color: "#059669" },
  fail: { color: "#dc2626" },
  label: { fontSize: 14, fontWeight: "500" },
  detail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});
