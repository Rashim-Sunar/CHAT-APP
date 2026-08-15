// ----------------------------------------
// @file   CallContext.tsx
// @desc   Live call session state machine — mesh WebRTC audio/video calling
//         for both direct and group conversations. Modeled on
//         DeviceLinkContext.tsx's shape (socket-driven state exposed via
//         context + imperative actions), since this is live session state
//         with side effects, not app data (not a zustand store).
// ----------------------------------------

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
import toast from "react-hot-toast";
import { useAuthContext } from "./Auth-Context";
import { useSocketContext } from "./SocketContext";
import useConversation from "../zustand/useConversation";
import { CallPeerManager, type CallPeerManagerCallbacks } from "../Utils/webrtcPeerManager";
import { getErrorMessage } from "../Utils/getErrorMessage";
import type {
  CallParticipantInfo,
  CallRosterSnapshotPayload,
  CallType,
  ConversationType,
  IncomingCallPayload,
} from "../types";

export type CallState =
  | "idle"
  | "ringing-outgoing"
  | "ringing-incoming"
  | "connecting"
  | "in-call";

export interface ActiveCallInfo {
  conversationId: string;
  conversationType: ConversationType;
  callType: CallType;
}

export interface CallBannerInfo {
  callType: CallType;
  participantCount: number;
}

export interface CallContextValue {
  callState: CallState;
  activeCall: ActiveCallInfo | null;
  incomingCall: IncomingCallPayload | null;
  localStream: MediaStream | null;
  participants: CallParticipantInfo[];
  isMuted: boolean;
  isCameraOff: boolean;
  // Live "ongoing call" headcount per conversation, for group call banners —
  // populated for every conversation this client is a member of, regardless
  // of whether this client has actually joined that call.
  callBanners: Record<string, CallBannerInfo>;
  // Primes callBanners for a conversation from the GET /:id/call REST
  // snapshot — covers a call that was already ongoing before this client
  // connected (reload, first login, or a call starting while this
  // conversation wasn't open). Live socket events take it from there.
  seedCallBanner: (conversationId: string, banner: CallBannerInfo | null) => void;
  startCall: (conversationId: string, callType: CallType) => Promise<void>;
  startGroupCall: (conversationId: string, callType: CallType) => Promise<void>;
  joinCall: (conversationId: string, callType: CallType) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export const useCallContext = (): CallContextValue => {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error("useCallContext must be used within CallProvider");
  }

  return context;
};

interface CallProviderProps {
  children: ReactNode;
}

const acquireLocalStream = (callType: CallType): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });

export const CallProvider = ({ children }: CallProviderProps) => {
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();
  const { conversations } = useConversation();

  const userId = authUser?.data?.user?._id || null;

  const [callState, setCallState] = useState<CallState>("idle");
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participantsById, setParticipantsById] = useState<Record<string, CallParticipantInfo>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
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

  // Torn down whenever a call ends for any reason — declined, hung up,
  // rejected for being full, or the local media prompt itself failing.
  const teardownCall = useCallback(() => {
    peerManagerRef.current?.destroy();
    peerManagerRef.current = null;
    setLocalStream(null);
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
              stream,
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

  // Shared by both explicit "join a live call" and "accept an incoming ring"
  // — on the wire both are the same call:join event.
  const beginJoin = useCallback(
    async (conversationId: string, callType: CallType, conversationType: ConversationType) => {
      if (!socket || !userId) return;

      try {
        const stream = await acquireLocalStream(callType);
        setLocalStream(stream);
        peerManagerRef.current = new CallPeerManager(stream, buildPeerCallbacks(conversationId));
        setActiveCall({ conversationId, conversationType, callType });
        setIncomingCall(null);
        setCallState("connecting");
        socket.emit("call:join", { conversationId, callType });
      } catch (mediaError: unknown) {
        toast.error(getErrorMessage(mediaError, "Couldn't access camera/microphone"));
        teardownCall();
      }
    },
    [socket, userId, buildPeerCallbacks, teardownCall]
  );

  const startCall = useCallback(
    async (conversationId: string, callType: CallType) => {
      if (!socket || !userId) return;

      try {
        const stream = await acquireLocalStream(callType);
        setLocalStream(stream);
        peerManagerRef.current = new CallPeerManager(stream, buildPeerCallbacks(conversationId));
        setActiveCall({ conversationId, conversationType: "direct", callType });
        setCallState("ringing-outgoing");
        socket.emit("call:invite", { conversationId, callType });
      } catch (mediaError: unknown) {
        toast.error(getErrorMessage(mediaError, "Couldn't access camera/microphone"));
        teardownCall();
      }
    },
    [socket, userId, buildPeerCallbacks, teardownCall]
  );

  const startGroupCall = useCallback(
    async (conversationId: string, callType: CallType) => {
      if (!socket || !userId) return;

      try {
        const stream = await acquireLocalStream(callType);
        setLocalStream(stream);
        peerManagerRef.current = new CallPeerManager(stream, buildPeerCallbacks(conversationId));
        setActiveCall({ conversationId, conversationType: "group", callType });
        setCallState("connecting");
        socket.emit("call:start", { conversationId, callType });
      } catch (mediaError: unknown) {
        toast.error(getErrorMessage(mediaError, "Couldn't access camera/microphone"));
        teardownCall();
      }
    },
    [socket, userId, buildPeerCallbacks, teardownCall]
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

  useEffect(() => {
    if (!socket || !userId) return;

    const onIncoming = (payload: IncomingCallPayload) => {
      // Busy — v1 has no auto-decline, the ring is just silently missed on
      // this device (other devices of the callee may still be free).
      if (callState !== "idle") return;
      setIncomingCall(payload);
      setCallState("ringing-incoming");
    };

    const onStarted = (payload: { conversationId: string; callType: CallType; startedByUserId: string }) => {
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

    const onDeclined = (payload: { conversationId: string; byUserId: string }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      toast.error("Call declined");
      teardownCall();
    };

    const onEnded = (payload: { conversationId: string; reason: "missed" | "ended" }) => {
      if (incomingCall?.conversationId === payload.conversationId) {
        setIncomingCall(null);
        setCallState("idle");
      } else if (activeCall?.conversationId === payload.conversationId) {
        if (payload.reason === "missed" && callState === "ringing-outgoing") {
          toast.error("No answer");
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

    const onJoinRejected = (payload: { conversationId: string; reason: "full" }) => {
      toast.error("This call is full (6/6) — try again once someone leaves");
      if (activeCall?.conversationId === payload.conversationId) {
        teardownCall();
      }
    };

    // Deliberately vague reason (doesn't say "blocked") — same silent-block
    // philosophy as messaging.
    const onInviteRejected = (payload: { conversationId: string; reason: "unavailable" }) => {
      if (activeCall?.conversationId !== payload.conversationId) return;
      toast.error("Can't reach this contact right now");
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

  // Tears down any in-progress call if the user logs out / socket dies.
  useEffect(() => {
    if (!socket) {
      teardownCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const participants = useMemo(() => Object.values(participantsById), [participantsById]);

  const contextValue = useMemo<CallContextValue>(
    () => ({
      callState,
      activeCall,
      incomingCall,
      localStream,
      participants,
      isMuted,
      isCameraOff,
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
    }),
    [
      callState,
      activeCall,
      incomingCall,
      localStream,
      participants,
      isMuted,
      isCameraOff,
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
    ]
  );

  return <CallContext.Provider value={contextValue}>{children}</CallContext.Provider>;
};
