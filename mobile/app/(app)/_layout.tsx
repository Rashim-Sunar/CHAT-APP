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
      <Stack.Screen name="index" options={{ title: "Chats" }} />
      <Stack.Screen name="new-chat" options={{ title: "New chat", presentation: "modal" }} />
      <Stack.Screen name="chat/[conversationId]" options={{ title: "" }} />
    </Stack>
  );
}
