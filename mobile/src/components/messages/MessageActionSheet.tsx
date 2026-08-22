import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import type { Message } from "../../types";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type MessageAction = "reply" | "edit" | "pin" | "forward" | "copy" | "delete";

interface MessageActionSheetProps {
  message: Message | null;
  isMine: boolean;
  currentUserId: string;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onAction: (action: MessageAction) => void;
}

export default function MessageActionSheet({
  message,
  isMine,
  currentUserId,
  onClose,
  onReact,
  onAction,
}: MessageActionSheetProps) {
  const insets = useSafeAreaInsets();

  if (!message) return null;

  const isDeleted = Boolean(message.deletedForEveryone);
  const isText = message.messageType === "text";
  const myReaction = message.reactions?.find((reaction) => reaction.userId === currentUserId);

  const items: { key: MessageAction; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
    { key: "reply", label: "Reply", icon: "arrow-undo-outline" },
    ...(isText && !isDeleted ? [{ key: "copy" as const, label: "Copy", icon: "copy-outline" as const }] : []),
    ...(isMine && isText && !isDeleted
      ? [{ key: "edit" as const, label: "Edit", icon: "create-outline" as const }]
      : []),
    { key: "pin", label: message.pinned ? "Unpin" : "Pin", icon: "pin-outline" },
    ...(!isDeleted ? [{ key: "forward" as const, label: "Forward", icon: "arrow-redo-outline" as const }] : []),
    { key: "delete", label: "Delete", icon: "trash-outline", danger: true },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {!isDeleted && (
            <View style={styles.reactionRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[styles.reactionButton, myReaction?.emoji === emoji && styles.reactionButtonActive]}
                  onPress={() => onReact(emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {items.map((item) => (
            <Pressable key={item.key} style={styles.actionRow} onPress={() => onAction(item.key)}>
              <Ionicons name={item.icon} size={20} color={item.danger ? colors.danger : colors.text} />
              <Text style={[styles.actionLabel, item.danger && styles.actionLabelDanger]}>{item.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
  },
  reactionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reactionButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reactionButtonActive: { backgroundColor: colors.primaryLight },
  reactionEmoji: { fontSize: 24 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingVertical: 14 },
  actionLabel: { fontSize: 15.5, color: colors.text },
  actionLabelDanger: { color: colors.danger },
});
