import { useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConversationDetailsPanel from "./ConversationDetailsPanel";
import { colors } from "../../constants/theme";

const OPEN_DURATION = 240;
const CLOSE_DURATION = 200;

interface ConversationDetailsDrawerProps {
  conversationId: string;
  visible: boolean;
  onClose: () => void;
}

export default function ConversationDetailsDrawer({
  conversationId,
  visible,
  onClose,
}: ConversationDetailsDrawerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Kept mounted through the closing animation so the panel doesn't vanish
  // before it has finished sliding out.
  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: OPEN_DURATION, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, { toValue: width, duration: CLOSE_DURATION, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, width, translateX, backdropOpacity]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Only visible during the slide, since the panel covers the screen once open. */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />

        <Animated.View
          style={[styles.drawer, { width, paddingTop: insets.top, transform: [{ translateX }] }]}
        >
          <ConversationDetailsPanel conversationId={conversationId} onClose={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  drawer: {
    height: "100%",
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 16,
  },
});
