import { Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../src/constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        // iOS tab bars have no press feedback beyond the icon/label color
        // change — no ripple, no flash. Overriding the default Android
        // ripple keeps tab switches feeling instant instead of "Material".
        tabBarButton: ({ ref: _ref, ...rest }) => (
          <Pressable {...rest} android_ripple={{ color: "transparent" }} />
        ),
        // Lifts the bar clear of the system navigation gesture area / buttons,
        // matching how the chat composer offsets itself.
        tabBarStyle: [
          styles.tabBar,
          { height: 58 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        // No cross-fade/shift between tabs — iOS switches are instant.
        animation: "none",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 8,
  },
  tabBarLabel: { fontSize: 11, fontWeight: "600", marginTop: -2 },
  tabBarItem: { paddingVertical: 2 },
});
