import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { formatClockTime } from "../../utils/formatTime";
import type { CallType, Message } from "../../types";

interface CallLogMessageProps {
  message: Message;
  currentUserId: string;
  otherUserName?: string;
  canCallBack: boolean;
  onCallBack: (callType: CallType) => void;
}

const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function CallLogMessage({
  message,
  currentUserId,
  otherUserName,
  canCallBack,
  onCallBack,
}: CallLogMessageProps) {
  const isVideo = message.callType === "video";
  const kind = isVideo ? "video" : "voice";
  // The call-log sender is always the original caller, so "not me" means the
  // call rang on this device.
  const wasIncoming = String(message.senderId) !== currentUserId;
  const them = otherUserName || "They";

  let label: string;
  let tone: "neutral" | "missed" = "neutral";

  if (message.callStatus === "missed") {
    tone = "missed";
    label = wasIncoming ? `You missed a ${kind} call` : `${them} missed your ${kind} call`;
  } else if (message.callStatus === "declined") {
    tone = "missed";
    label = wasIncoming ? `You declined a ${kind} call` : `${them} declined your ${kind} call`;
  } else {
    const outgoing = wasIncoming ? "Incoming" : "Outgoing";
    label = message.callDurationSec
      ? `${outgoing} ${kind} call · ${formatDuration(message.callDurationSec)}`
      : `${outgoing} ${kind} call`;
  }

  const iconName = tone === "missed" ? "call" : isVideo ? "videocam" : "call";

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, tone === "missed" && styles.iconCircleMissed]}>
          <Ionicons
            name={iconName}
            size={14}
            color={tone === "missed" ? colors.danger : colors.textMuted}
            style={tone === "missed" && !isVideo ? styles.missedIcon : undefined}
          />
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.label, tone === "missed" && styles.labelMissed]}>{label}</Text>
          <Text style={styles.time}>{formatClockTime(message.createdAt)}</Text>
        </View>

        {canCallBack && (
          <TouchableOpacity
            style={styles.callBack}
            onPress={() => onCallBack(message.callType || "audio")}
            hitSlop={6}
          >
            <Text style={styles.callBackText}>Call back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", marginVertical: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "88%",
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleMissed: { backgroundColor: colors.dangerBackground },
  missedIcon: { transform: [{ rotate: "135deg" }] },
  textGroup: { flexShrink: 1 },
  label: { fontSize: 13, fontWeight: "500", color: colors.text },
  labelMissed: { color: colors.danger },
  time: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  callBack: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  callBackText: { fontSize: 12, fontWeight: "600", color: colors.primary },
});
