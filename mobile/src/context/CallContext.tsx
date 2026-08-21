import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import { mediaDevices, type MediaStream } from "react-native-webrtc";
import { useAuthContext } from "./AuthContext";
import { useSocketContext } from "./SocketContext";
import useConversationStore from "../store/useConversationStore";
import { CallPeerManager, type CallPeerManagerCallbacks } from "../calls/webrtcPeerManager";
import { requestCallPermissions } from "../calls/permissions";
import { setSpeakerphone, startAudioSession, stopAudioSession } from "../calls/audioSession";
import type {
  CallParticipantInfo,
  CallRosterSnapshotPayload,
  CallType,
  ConversationType,
  IncomingCallPayload,
} from "../types";

export type CallState = "idle" | "ringing-outgoing" | "ringing-incoming" | "connecting" | "in-call";

export interface ActiveCallInfo {
  conversationId: string;
  conversationType: ConversationType;
  callType: CallType;
}

export interface CallBannerInfo {
  callType: CallType;
  participantCount: number;
}

interface CallContextValue {
  callState: CallState;
  activeCall: ActiveCallInfo | null;
  incomingCall: IncomingCallPayload | null;
  localStreamUrl: string | null;
  participants: CallParticipantInfo[];
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  callBanners: Record<string, CallBannerInfo>;
  seedCallBanner: (conversationId: string, banner: CallBannerInfo | null) => void;
  startCall: (conversationId: string, callType: CallType) => Promise<void>;
  startGroupCall: (conversationId: string, callType: CallType) => Promise<void>;
  joinCall: (conversationId: string, callType: CallType) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export const useCallContext = (): CallContextValue => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext must be used within CallProvider");
  }
  return context;
};

const acquireLocalStream = async (callType: CallType): Promise<MediaStream> => {
  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video" ? { facingMode: "user" } : false,
  });
  return stream as MediaStream;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();
  const conversations = useConversationStore((state) => state.conversations);

  const userId = authUser?.data?.user?._id || null;

  const [callState, setCallState] = useState<CallState>("idle");
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [participantsById, setParticipantsById] = useState<Record<string, CallParticipantInfo>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callBanners, setCallBanners] = useState<Record<string, CallBannerInfo>>({});

  const peerManagerRef = useRef<CallPeerManager | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const resolveParticipantMeta = useCallback(
    (conversationId: string, participantUserId: string): { userName: string; profilePic?: string } => {
      const conversation = conversationsRef.current.find((entry) => entry._id === conversationId);
      const participant = conversation?.participants.find((entry) => entry._id === participantUserId);
      return { userName: participant?.userName || "Unknown", profilePic: participant?.profilePic };
    },
    []
  );

  const addRosterParticipant = useCallback(
    (conversationId: string, participantUserId: string) => {
      setParticipantsById((prev) => {
        if (prev[participantUserId]) return prev;
        const meta = resolveParticipantMeta(conversationId, participantUserId);
        return {
          ...prev,
          [participantUserId]: {
            userId: participantUserId,
            userName: meta.userName,
            profilePic: meta.profilePic,
            audioEnabled: true,
            videoEnabled: true,
          },
        };
      });
    },
    [resolveParticipantMeta]
  );

  const seedCallBanner = useCallback((conversationId: string, banner: CallBannerInfo | null) => {
    setCallBanners((prev) => {
      if (!banner) {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      }
      return { ...prev, [conversationId]: banner };
    });
  }, []);

  const teardownCall = useCallback(() => {
    stopAudioSession();
    peerManagerRef.current?.destroy();
    peerManagerRef.current = null;
    setLocalStreamUrl(null);
    setIsSpeakerOn(false);
    setParticipantsById({});
    setActiveCall(null);
    setIncomingCall(null);
    setCallState("idle");
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const buildPeerCallbacks = useCallback(
    (conversationId: string): CallPeerManagerCallbacks => ({
      onRemoteStream: (participantUserId, stream) => {
        setParticipantsById((prev) => {
          const meta = resolveParticipantMeta(conversationId, participantUserId);
          const existing = prev[participantUserId];
          return {
            ...prev,
            [participantUserId]: {
              userId: participantUserId,
              userName: existing?.userName || meta.userName,
              profilePic: existing?.profilePic || meta.profilePic,
              audioEnabled: existing?.audioEnabled ?? true,
              videoEnabled: existing?.videoEnabled ?? true,
              streamUrl: stream.toURL(),
            },
          };
        });
      },
      onPeerClosed: (participantUserId) => {
        setParticipantsById((prev) => {
          if (!prev[participantUserId]) return prev;
          const next = { ...prev };
          delete next[participantUserId];
          return next;
        });
      },
      onIceCandidate: (participantUserId, candidate) => {
        socket?.emit("call:ice-candidate", { conversationId, toUserId: participantUserId, candidate });
      },
      onOffer: (participantUserId, sdp) => {
        socket?.emit("call:offer", { conversationId, toUserId: participantUserId, sdp });
      },
      onAnswer: (participantUserId, sdp) => {
        socket?.emit("call:answer", { conversationId, toUserId: participantUserId, sdp });
      },
    }),
    [socket, resolveParticipantMeta]
  );

  const prepareMedia = useCallback(
    async (conversationId: string, callType: CallType): Promise<boolean> => {
      const granted = await requestCallPermissions(callType);
      if (!granted) {
        Alert.alert(
          "Permission needed",
          `ChatApp needs ${callType === "video" ? "camera and microphone" : "microphone"} access to place calls.`
        );
        return false;
      }

      try {
        const stream = await acquireLocalStream(callType);
        // Must be active before media flows, otherwise Android never enters
        // communication mode and inbound audio has nowhere to play.
        startAudioSession(callType);
        setIsSpeakerOn(callType === "video");
        setLocalStreamUrl(stream.toURL());
        peerManagerRef.current = new CallPeerManager(stream, buildPeerCallbacks(conversationId));
        return true;
      } catch (mediaError: unknown) {
        Alert.alert(
          "Call failed",
          mediaError instanceof Error
            ? mediaError.message
            : "Couldn't access your camera or microphone."
        );
        teardownCall();
        return false;
      }
    },
    [buildPeerCallbacks, teardownCall]
  );

  const beginJoin = useCallback(
    async (conversationId: string, callType: CallType, conversationType: ConversationType) => {
      if (!socket || !userId) return;
      if (!(await prepareMedia(conversationId, callType))) return;

      setActiveCall({ conversationId, conversationType, callType });
      setIncomingCall(null);
      setCallState("connecting");
      socket.emit("call:join", { conversationId, callType });
    },
    [socket, userId, prepareMedia]
  );

  const startCall = useCallback(
    async (conversationId: string, callType: CallType) => {
      if (!socket || !userId) return;
      if (!(await prepareMedia(conversationId, callType))) return;

      setActiveCall({ conversationId, conversationType: "direct", callType });
      setCallState("ringing-outgoing");
      socket.emit("call:invite", { conversationId, callType });
    },
    [socket, userId, prepareMedia]
  );

  const startGroupCall = useCallback(
    async (conversationId: string, callType: CallType) => {
      if (!socket || !userId) return;
      if (!(await prepareMedia(conversationId, callType))) return;

      setActiveCall({ conversationId, conversationType: "group", callType });
      setCallState("connecting");
      socket.emit("call:start", { conversationId, callType });
    },
    [socket, userId, prepareMedia]
  );

  const joinCall = useCallback(
    (conversationId: string, callType: CallType) => beginJoin(conversationId, callType, "group"),
    [beginJoin]
  );

  const acceptIncoming = useCallback(async () => {
    if (!incomingCall) return;
    await beginJoin(incomingCall.conversationId, incomingCall.callType, "direct");
  }, [incomingCall, beginJoin]);

  const declineIncoming = useCallback(() => {
    if (!incomingCall || !socket) return;
    socket.emit("call:decline", { conversationId: incomingCall.conversationId });
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall, socket]);

  const leaveCall = useCallback(() => {
    if (!activeCall || !socket) return;
    socket.emit("call:leave", { conversationId: activeCall.conversationId });
    teardownCall();
  }, [activeCall, socket, teardownCall]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      peerManagerRef.current?.setMuted(next);
      if (activeCall && socket) {
        socket.emit("call:media-state", {
          conversationId: activeCall.conversationId,
          audioEnabled: !next,
          videoEnabled: !isCameraOff,
        });
      }
      return next;
    });
  }, [activeCall, socket, isCameraOff]);

  const toggleCamera = useCallback(() => {
    setIsCameraOff((prev) => {
      const next = !prev;
      peerManagerRef.current?.setCameraOff(next);
      if (activeCall && socket) {
        socket.emit("call:media-state", {
          conversationId: activeCall.conversationId,
          audioEnabled: !isMuted,
          videoEnabled: !next,
        });
      }
      return next;
    });
  }, [activeCall, socket, isMuted]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      setSpeakerphone(next);
      return next;
    });
  }, []);

  const switchCamera = useCallback(() => {
    peerManagerRef.current?.switchCamera();
  }, []);

  useEffect(() => {
    if (!socket || !userId) return;

    const onIncoming = (payload: IncomingCallPayload) => {
      if (callState !== "idle") return;
      setIncomingCall(payload);
      setCallState("ringing-incoming");
    };

    const onStarted = (payload: { conversationId: string; callType: CallType }) => {
      setCallBanners((prev) => ({
        ...prev,
        [payload.conversationId]: { callType: payload.callType, participantCount: 1 },
      }));
    };

    const onInviteResolved = (payload: { conversationId: string }) => {
      if (callState === "ringing-incoming" && incomingCall?.conversationId === payload.conversationId) {
        setIncomingCall(null);
        setCallState("idle");
      }
    };

    const onDeclined = (payload: { conversationId: string }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      Alert.alert("Call declined");
      teardownCall();
    };

    const onEnded = (payload: { conversationId: string; reason: "missed" | "ended" }) => {
      if (incomingCall?.conversationId === payload.conversationId) {
        setIncomingCall(null);
        setCallState("idle");
      } else if (activeCall?.conversationId === payload.conversationId) {
        if (payload.reason === "missed" && callState === "ringing-outgoing") {
          Alert.alert("No answer");
        }
        teardownCall();
      }

      setCallBanners((prev) => {
        if (!prev[payload.conversationId]) return prev;
        const next = { ...prev };
        delete next[payload.conversationId];
        return next;
      });
    };

    const onJoinRejected = (payload: { conversationId: string }) => {
      Alert.alert("Call is full", "This call has reached its participant limit.");
      if (activeCall?.conversationId === payload.conversationId) {
        teardownCall();
      }
    };

    const onInviteRejected = (payload: { conversationId: string }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      Alert.alert("Can't reach this contact right now");
      teardownCall();
    };

    const onRosterSnapshot = (payload: CallRosterSnapshotPayload) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      setCallState("in-call");
      payload.participantUserIds.forEach((participantId) => {
        addRosterParticipant(payload.conversationId, participantId);
        peerManagerRef.current?.addPeerAsAnswerer(participantId);
      });
    };

    const onParticipantJoined = (payload: { conversationId: string; userId: string }) => {
      setCallBanners((prev) => {
        const existing = prev[payload.conversationId];
        if (!existing) return prev;
        return {
          ...prev,
          [payload.conversationId]: { ...existing, participantCount: existing.participantCount + 1 },
        };
      });

      if (activeCall?.conversationId !== payload.conversationId) return;
      addRosterParticipant(payload.conversationId, payload.userId);
      void peerManagerRef.current?.addPeerAsOfferer(payload.userId);
      setCallState((prev) => (prev === "ringing-outgoing" || prev === "connecting" ? "in-call" : prev));
    };

    const onParticipantLeft = (payload: { conversationId: string; userId: string }) => {
      setCallBanners((prev) => {
        const existing = prev[payload.conversationId];
        if (!existing) return prev;
        const nextCount = Math.max(0, existing.participantCount - 1);
        if (nextCount === 0) {
          const next = { ...prev };
          delete next[payload.conversationId];
          return next;
        }
        return { ...prev, [payload.conversationId]: { ...existing, participantCount: nextCount } };
      });

      if (activeCall?.conversationId !== payload.conversationId) return;
      peerManagerRef.current?.removePeer(payload.userId);
      setParticipantsById((prev) => {
        if (!prev[payload.userId]) return prev;
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
    };

    const onOffer = (payload: { conversationId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      void peerManagerRef.current?.handleOffer(payload.fromUserId, payload.sdp);
    };

    const onAnswer = (payload: { conversationId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      void peerManagerRef.current?.handleAnswer(payload.fromUserId, payload.sdp);
    };

    const onIceCandidate = (payload: {
      conversationId: string;
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      void peerManagerRef.current?.handleIceCandidate(payload.fromUserId, payload.candidate);
    };

    const onMediaState = (payload: {
      conversationId: string;
      fromUserId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      setParticipantsById((prev) => {
        const existing = prev[payload.fromUserId];
        if (!existing) return prev;
        return {
          ...prev,
          [payload.fromUserId]: {
            ...existing,
            audioEnabled: payload.audioEnabled,
            videoEnabled: payload.videoEnabled,
          },
        };
      });
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:started", onStarted);
    socket.on("call:invite-resolved", onInviteResolved);
    socket.on("call:declined", onDeclined);
    socket.on("call:ended", onEnded);
    socket.on("call:join-rejected", onJoinRejected);
    socket.on("call:invite-rejected", onInviteRejected);
    socket.on("call:roster-snapshot", onRosterSnapshot);
    socket.on("call:participant-joined", onParticipantJoined);
    socket.on("call:participant-left", onParticipantLeft);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:media-state", onMediaState);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:started", onStarted);
      socket.off("call:invite-resolved", onInviteResolved);
      socket.off("call:declined", onDeclined);
      socket.off("call:ended", onEnded);
      socket.off("call:join-rejected", onJoinRejected);
      socket.off("call:invite-rejected", onInviteRejected);
      socket.off("call:roster-snapshot", onRosterSnapshot);
      socket.off("call:participant-joined", onParticipantJoined);
      socket.off("call:participant-left", onParticipantLeft);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:media-state", onMediaState);
    };
  }, [socket, userId, callState, activeCall, incomingCall, addRosterParticipant, teardownCall]);

  useEffect(() => {
    if (!socket) teardownCall();
  }, [socket, teardownCall]);

  const participants = useMemo(() => Object.values(participantsById), [participantsById]);

  const value = useMemo<CallContextValue>(
    () => ({
      callState,
      activeCall,
      incomingCall,
      localStreamUrl,
      participants,
      isMuted,
      isCameraOff,
      isSpeakerOn,
      callBanners,
      seedCallBanner,
      startCall,
      startGroupCall,
      joinCall,
      acceptIncoming,
      declineIncoming,
      leaveCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      switchCamera,
    }),
    [
      callState,
      activeCall,
      incomingCall,
      localStreamUrl,
      participants,
      isMuted,
      isCameraOff,
      isSpeakerOn,
      callBanners,
      seedCallBanner,
      startCall,
      startGroupCall,
      joinCall,
      acceptIncoming,
      declineIncoming,
      leaveCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      switchCamera,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
