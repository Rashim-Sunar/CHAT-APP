import { useCallback } from "react";
import { Stack } from "expo-router";
import { listConversations } from "../../src/api/conversations";
import { useAuthContext } from "../../src/context/AuthContext";
import useConversationStore from "../../src/store/useConversationStore";
import useListenMessages from "../../src/hooks/useListenMessages";
import { colors } from "../../src/constants/theme";
import { useTheme } from "../../src/context/ThemeContext";

export default function AppLayout() {
  const setConversations = useConversationStore((state) => state.setConversations);
  const { isDark } = useTheme();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const refreshConversations = useCallback(() => {
    void listConversations(currentUserId)
      .then((conversations) => setConversations(conversations))
      .catch(() => undefined);
  }, [setConversations, currentUserId]);

  // Lives at the layout so realtime updates keep flowing regardless of which
  // screen is on top of the stack.
  useListenMessages(refreshConversations);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? "#0b0f1a" : colors.surface },
        headerTitleStyle: { fontWeight: "700", color: isDark ? "#f3f5fa" : colors.text },
        headerTintColor: isDark ? "#a5aec0" : colors.primary,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="new-group" options={{ title: "New group" }} />
      <Stack.Screen name="join-group" options={{ title: "Join group" }} />
      <Stack.Screen name="forward" options={{ title: "Forward to", presentation: "modal" }} />
      <Stack.Screen name="chat/[conversationId]/index" options={{ title: "" }} />
      <Stack.Screen name="chat/[conversationId]/add-members" options={{ title: "Add members" }} />
    </Stack>
  );
}
