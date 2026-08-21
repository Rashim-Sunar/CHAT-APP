import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "../../context/CallContext";
import useConversationStore from "../../store/useConversationStore";
import Avatar from "../Avatar";
import { colors } from "../../constants/theme";
import type { CallParticipantInfo } from "../../types";

const STATE_LABEL: Record<string, string> = {
  "ringing-outgoing": "Ringing…",
  connecting: "Connecting…",
};

const formatElapsed = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

interface VideoSurfaceProps {
  streamUrl?: string;
  hasVideo: boolean;
  name: string;
  id: string;
  avatarUri?: string;
  mirror?: boolean;
  avatarSize: number;
  objectFit?: "cover" | "contain";
  zOrder?: number;
}

// Falls back to an avatar whenever there's no video track to show — camera
// off, audio-only call, or a stream that hasn't arrived yet.
function VideoSurface({
  streamUrl,
  hasVideo,
  name,
  id,
  avatarUri,
  mirror = false,
  avatarSize,
  objectFit = "cover",
  zOrder = 0,
}: VideoSurfaceProps) {
  if (hasVideo && streamUrl) {
    return (
      <RTCView
        streamURL={streamUrl}
        style={styles.fill}
        objectFit={objectFit}
        mirror={mirror}
        zOrder={zOrder}
      />
    );
  }

  return (
    <View style={styles.avatarFallback}>
      <Avatar id={id} name={name} uri={avatarUri} size={avatarSize} />
    </View>
  );
}

function GroupTile({ participant, isVideoCall }: { participant: CallParticipantInfo; isVideoCall: boolean }) {
  return (
    <View style={styles.gridTile}>
      <VideoSurface
        id={participant.userId}
        name={participant.userName}
        avatarUri={participant.profilePic}
        streamUrl={participant.streamUrl}
        hasVideo={isVideoCall && participant.videoEnabled}
        avatarSize={56}
      />
      <View style={styles.tileFooter}>
        <Text style={styles.tileName} numberOfLines={1}>
          {participant.userName}
        </Text>
        {!participant.audioEnabled && <Ionicons name="mic-off" size={13} color="#fff" />}
      </View>
    </View>
  );
}

export default function ActiveCallOverlay() {
  const {
    callState,
    activeCall,
    localStreamUrl,
    participants,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    switchCamera,
  } = useCallContext();

  const insets = useSafeAreaInsets();
  const conversations = useConversationStore((state) => state.conversations);

  // Swaps which feed occupies the full screen; tapping the small tile flips it.
  const [swapped, setSwapped] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isActive = callState === "ringing-outgoing" || callState === "connecting" || callState === "in-call";
  const conversationId = activeCall?.conversationId;

  useEffect(() => {
    setSwapped(false);
    setElapsedSeconds(0);
  }, [conversationId]);

  const isConnected = callState === "in-call";
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    tickRef.current = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isConnected]);

  if (!isActive || !activeCall) return null;

  const conversation = conversations.find((entry) => entry._id === activeCall.conversationId);
  const isVideoCall = activeCall.callType === "video";
  const isGroupCall = activeCall.conversationType === "group";
  const statusLabel = STATE_LABEL[callState] ?? (isConnected ? formatElapsed(elapsedSeconds) : "");

  const remote = participants[0];
  const localHasVideo = isVideoCall && !isCameraOff && Boolean(localStreamUrl);
  const remoteHasVideo = isVideoCall && Boolean(remote?.videoEnabled) && Boolean(remote?.streamUrl);

  const showPiP = !isGroupCall && isVideoCall && Boolean(remote);

  // In the swapped state the local feed takes the full screen and the remote
  // moves into the small tile. Before anyone joins, a video call previews the
  // local camera full screen — matching how the reference apps ring.
  const bigIsLocal = remote ? swapped : isVideoCall;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={leaveCall}>
      <View style={styles.container}>
        {isGroupCall ? (
          <View style={[styles.groupStage, { paddingTop: insets.top + 64 }]}>
            {participants.length === 0 ? (
              <View style={styles.waiting}>
                <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.4)" />
                <Text style={styles.waitingText}>Waiting for others to join…</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {participants.map((participant) => (
                  <GroupTile key={participant.userId} participant={participant} isVideoCall={isVideoCall} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.fill}>
            <VideoSurface
              id={bigIsLocal ? "local" : remote?.userId || activeCall.conversationId}
              name={bigIsLocal ? "You" : remote?.userName || conversation?.displayName || "Calling"}
              avatarUri={bigIsLocal ? undefined : remote?.profilePic || conversation?.displayAvatar}
              streamUrl={bigIsLocal ? localStreamUrl || undefined : remote?.streamUrl}
              hasVideo={bigIsLocal ? localHasVideo : remoteHasVideo}
              mirror={bigIsLocal}
              avatarSize={132}
              zOrder={0}
            />
          </View>
        )}

        <View style={[styles.header, { paddingTop: insets.top + 12 }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {conversation?.displayName || remote?.userName || "Call"}
          </Text>
          {Boolean(statusLabel) && <Text style={styles.status}>{statusLabel}</Text>}
          {isGroupCall && isConnected && (
            <Text style={styles.status}>
              {participants.length + 1} on this call
            </Text>
          )}
        </View>

        {showPiP && (
          <Pressable
            style={[styles.pip, { top: insets.top + 84 }]}
            onPress={() => setSwapped((prev) => !prev)}
          >
            <VideoSurface
              id={bigIsLocal ? remote?.userId || "remote" : "local"}
              name={bigIsLocal ? remote?.userName || "" : "You"}
              avatarUri={bigIsLocal ? remote?.profilePic : undefined}
              streamUrl={bigIsLocal ? remote?.streamUrl : localStreamUrl || undefined}
              hasVideo={bigIsLocal ? remoteHasVideo : localHasVideo}
              mirror={!bigIsLocal}
              avatarSize={40}
              zOrder={1}
            />
            {bigIsLocal && remote && !remote.audioEnabled && (
              <View style={styles.pipMuted}>
                <Ionicons name="mic-off" size={12} color="#fff" />
              </View>
            )}
          </Pressable>
        )}

        {!isGroupCall && isVideoCall && !remoteHasVideo && remote && !bigIsLocal && (
          <Text style={[styles.cameraOffHint, { top: insets.top + 84 }]}>
            {remote.userName}&apos;s camera is off
          </Text>
        )}

        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
            onPress={toggleSpeaker}
          >
            <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color="#fff" />
          </TouchableOpacity>

          {isVideoCall && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
                onPress={toggleCamera}
              >
                <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.controlButton, styles.hangUp]} onPress={leaveCall}>
            <Ionicons name="call" size={24} color="#fff" style={styles.hangUpIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  avatarFallback: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111c2e",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 24,
    paddingBottom: 14,
    backgroundColor: "rgba(11,18,32,0.45)",
  },
  title: { fontSize: 19, fontWeight: "700", color: "#fff" },
  status: { fontSize: 13.5, color: "rgba(255,255,255,0.7)" },
  pip: {
    position: "absolute",
    right: 14,
    width: 108,
    height: 152,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111c2e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  pipMuted: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(11,18,32,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOffHint: {
    position: "absolute",
    left: 20,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12.5,
  },
  groupStage: { flex: 1 },
  waiting: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  waitingText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  gridTile: {
    width: "47%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: "#111c2e",
    overflow: "hidden",
  },
  tileFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(11,18,32,0.6)",
  },
  tileName: { flex: 1, color: "#fff", fontSize: 12.5, fontWeight: "500" },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 18,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  hangUp: { backgroundColor: colors.danger },
  hangUpIcon: { transform: [{ rotate: "135deg" }] },
});
