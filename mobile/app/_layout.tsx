// Must be the very first import — installs the WebCrypto polyfill before
// anything else in the tree can touch `crypto`.
import "../src/crypto/webcryptoPolyfill";

import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthContextProvider, useAuthContext } from "../src/context/AuthContext";
import { SocketContextProvider } from "../src/context/SocketContext";
import { DeviceLinkProvider, useDeviceLinkContext } from "../src/context/DeviceLinkContext";
import { CallProvider } from "../src/context/CallContext";
import DeviceLinkGate from "../src/components/DeviceLinkGate";
import LinkRequestPrompt from "../src/components/LinkRequestPrompt";
import CallOverlayHost from "../src/components/calls/CallOverlayHost";
import { colors } from "../src/constants/theme";

function RootNavigator() {
  const { authUser, loading } = useAuthContext();
  const { status: deviceLinkStatus } = useDeviceLinkContext();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // A signed-in device without usable key material can't read or send
  // anything, so it stays gated until linking completes.
  if (authUser && deviceLinkStatus !== "ready") {
    return <DeviceLinkGate />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!authUser}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(authUser)}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      <LinkRequestPrompt />
      <CallOverlayHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthContextProvider>
      <SocketContextProvider>
        <DeviceLinkProvider>
          <CallProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </CallProvider>
        </DeviceLinkProvider>
      </SocketContextProvider>
    </AuthContextProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
