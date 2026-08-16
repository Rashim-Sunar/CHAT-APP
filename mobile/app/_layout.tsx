// Must be the very first import — installs the WebCrypto polyfill before
// anything else in the tree can touch `crypto`.
import "../src/crypto/webcryptoPolyfill";

import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { AuthContextProvider, useAuthContext } from "../src/context/AuthContext";
import { SocketContextProvider } from "../src/context/SocketContext";

function RootNavigator() {
  const { authUser, loading } = useAuthContext();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!authUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(authUser)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthContextProvider>
      <SocketContextProvider>
        <RootNavigator />
      </SocketContextProvider>
    </AuthContextProvider>
  );
}
