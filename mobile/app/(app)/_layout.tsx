import { Stack } from "expo-router";
import { colors } from "../../src/constants/theme";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[conversationId]/index" options={{ title: "" }} />
      <Stack.Screen name="chat/[conversationId]/details" options={{ title: "Details" }} />
    </Stack>
  );
}
