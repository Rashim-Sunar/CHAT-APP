import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "../../context/CallContext";
import Avatar from "../Avatar";
import { colors } from "../../constants/theme";

export default function IncomingCallOverlay() {
  const { callState, incomingCall, acceptIncoming, declineIncoming } = useCallContext();

  if (callState !== "ringing-incoming" || !incomingCall) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.identity}>
          <Avatar
            id={incomingCall.fromUserId}
            name={incomingCall.fromUserName}
            uri={incomingCall.fromUserAvatar}
            size={112}
          />
          <Text style={styles.name}>{incomingCall.fromUserName}</Text>
          <Text style={styles.subtitle}>
            Incoming {incomingCall.callType === "video" ? "video" : "audio"} call
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <TouchableOpacity style={[styles.actionButton, styles.decline]} onPress={declineIncoming}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          <View style={styles.action}>
            <TouchableOpacity
              style={[styles.actionButton, styles.accept]}
              onPress={() => void acceptIncoming()}
            >
              <Ionicons
                name={incomingCall.callType === "video" ? "videocam" : "call"}
                size={28}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "space-between", paddingVertical: 90 },
  identity: { alignItems: "center", gap: 10, marginTop: 40 },
  name: { fontSize: 26, fontWeight: "700", color: "#fff", marginTop: 18 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.65)" },
  actions: { flexDirection: "row", justifyContent: "space-evenly", paddingHorizontal: 40 },
  action: { alignItems: "center", gap: 10 },
  actionButton: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  decline: { backgroundColor: colors.danger },
  accept: { backgroundColor: colors.online },
  actionLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500" },
});
