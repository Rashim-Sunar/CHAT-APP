import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Chats" }} />
      <Stack.Screen name="new-chat" options={{ title: "New chat", presentation: "modal" }} />
      <Stack.Screen name="chat/[conversationId]" options={{ title: "" }} />
    </Stack>
  );
}
