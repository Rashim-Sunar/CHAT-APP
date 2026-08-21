import { memo, useMemo } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { formatClockTime } from "../../utils/formatTime";
import type { Message } from "../../types";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
  showSenderName: boolean;
  replyTarget?: Message;
  onLongPress: (message: Message) => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function MessageBubble({
  message,
  isMine,
  senderName,
  showSenderName,
  replyTarget,
  onLongPress,
}: MessageBubbleProps) {
  const body = message.text ?? message.message ?? "";
  const isDeleted = Boolean(message.deletedForEveryone);

  const groupedReactions = useMemo(() => {
    const counts = new Map<string, number>();
    (message.reactions || []).forEach((reaction) => {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [message.reactions]);

  const renderContent = () => {
    if (isDeleted) {
      return (
        <View style={styles.deletedRow}>
          <Ionicons name="ban-outline" size={13} color={isMine ? "rgba(255,255,255,0.7)" : colors.textFaint} />
          <Text style={[styles.deletedText, isMine && styles.deletedTextMine]}>{body}</Text>
        </View>
      );
    }

    if (message.messageType === "image" && message.fileUrl) {
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => void Linking.openURL(message.fileUrl as string)}>
          <Image source={{ uri: message.fileUrl }} style={styles.mediaImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }

    if (message.messageType === "video" && message.fileUrl) {
      return (
        <TouchableOpacity
          style={styles.videoTile}
          activeOpacity={0.85}
          onPress={() => void Linking.openURL(message.fileUrl as string)}
        >
          <Ionicons name="play-circle" size={44} color="#fff" />
          <Text style={styles.videoLabel}>Video</Text>
        </TouchableOpacity>
      );
    }

    if (message.messageType === "file" && message.fileUrl) {
      return (
        <TouchableOpacity
          style={styles.fileRow}
          activeOpacity={0.7}
          onPress={() => void Linking.openURL(message.fileUrl as string)}
        >
          <View style={[styles.fileIcon, isMine && styles.fileIconMine]}>
            <Ionicons name="document" size={18} color={isMine ? "#fff" : colors.primary} />
          </View>
          <View style={styles.fileMeta}>
            <Text style={[styles.fileName, isMine && styles.textMine]} numberOfLines={1}>
              {message.fileName || "Attachment"}
            </Text>
            {Boolean(message.fileSize) && (
              <Text style={[styles.fileSize, isMine && styles.fileSizeMine]}>
                {formatFileSize(message.fileSize)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return <Text style={isMine ? styles.textMine : styles.textTheirs}>{body}</Text>;
  };

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {showSenderName && !isMine && <Text style={styles.senderName}>{senderName}</Text>}

      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => onLongPress(message)}
        delayLongPress={250}
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isMine ? styles.tailMine : styles.tailTheirs,
        ]}
      >
        {message.forwarded && (
          <View style={styles.metaRow}>
            <Ionicons
              name="arrow-redo-outline"
              size={11}
              color={isMine ? "rgba(255,255,255,0.7)" : colors.textFaint}
            />
            <Text style={[styles.metaText, isMine && styles.metaTextMine]}>Forwarded</Text>
          </View>
        )}

        {replyTarget && (
          <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
            <Text style={[styles.replyBody, isMine && styles.replyBodyMine]} numberOfLines={2}>
              {replyTarget.deletedForEveryone
                ? "Message deleted"
                : replyTarget.text || replyTarget.message || replyTarget.fileName || "Attachment"}
            </Text>
          </View>
        )}

        {renderContent()}

        <View style={styles.footer}>
          {message.pinned && (
            <Ionicons name="pin" size={10} color={isMine ? "rgba(255,255,255,0.75)" : colors.textFaint} />
          )}
          {message.edited && !isDeleted && (
            <Text style={[styles.footerText, isMine && styles.footerTextMine]}>edited</Text>
          )}
          <Text style={[styles.footerText, isMine && styles.footerTextMine]}>
            {formatClockTime(message.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      {groupedReactions.length > 0 && (
        <View style={[styles.reactions, isMine ? styles.reactionsMine : styles.reactionsTheirs]}>
          {groupedReactions.map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionChip}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default memo(MessageBubble);

const styles = StyleSheet.create({
  row: { marginVertical: 3 },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  senderName: { fontSize: 11.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3, marginLeft: 12 },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  bubbleMine: { backgroundColor: colors.bubbleMine },
  bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderWidth: 1, borderColor: colors.border },
  tailMine: { borderBottomRightRadius: 4 },
  tailTheirs: { borderBottomLeftRadius: 4 },
  textMine: { color: colors.bubbleTextMine, fontSize: 15.5, lineHeight: 20 },
  textTheirs: { color: colors.bubbleTextTheirs, fontSize: 15.5, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  metaText: { fontSize: 11, fontStyle: "italic", color: colors.textFaint },
  metaTextMine: { color: "rgba(255,255,255,0.7)" },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyQuoteMine: { backgroundColor: "rgba(255,255,255,0.16)", borderLeftColor: "rgba(255,255,255,0.8)" },
  replyBody: { fontSize: 12.5, color: colors.textMuted },
  replyBodyMine: { color: "rgba(255,255,255,0.85)" },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  deletedText: { fontSize: 14.5, fontStyle: "italic", color: colors.textFaint },
  deletedTextMine: { color: "rgba(255,255,255,0.7)" },
  mediaImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: colors.background },
  videoTile: {
    width: 220,
    height: 150,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  videoLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2, minWidth: 180 },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  fileIconMine: { backgroundColor: "rgba(255,255,255,0.2)" },
  fileMeta: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: "500", color: colors.text },
  fileSize: { fontSize: 11.5, color: colors.textFaint, marginTop: 1 },
  fileSizeMine: { color: "rgba(255,255,255,0.7)" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  footerText: { fontSize: 10.5, color: colors.textFaint },
  footerTextMine: { color: "rgba(255,255,255,0.75)" },
  reactions: { flexDirection: "row", gap: 4, marginTop: -6 },
  reactionsMine: { marginRight: 8 },
  reactionsTheirs: { marginLeft: 8 },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10.5, fontWeight: "600", color: colors.textMuted },
});
