import { useEffect, useRef } from "react";
import { FiMicOff } from "react-icons/fi";
import Avatar from "../common/Avatar";
import type { CallParticipantInfo, CallType } from "../../types";

interface VideoTileProps {
  stream?: MediaStream | null;
  muted?: boolean; // local tile is always muted locally to avoid echoing itself back
  isVideoActive: boolean;
  isAudioMuted: boolean;
  name: string;
  avatarSrc?: string;
  isLocal?: boolean;
}

const VideoTile = ({ stream, muted, isVideoActive, isAudioMuted, name, avatarSrc, isLocal }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.srcObject = stream || null;

    // A stream attached long after it was captured (e.g. the caller's own
    // preview, unattached through the whole ring) can have autoPlay silently
    // never kick in on some browsers — no error, it just never starts.
    if (stream) {
      videoElement.play().catch(() => {
        // Best-effort; controls stay usable either way.
      });
    }
  }, [stream]);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-slate-800">
      {stream && isVideoActive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${isLocal ? "-scale-x-100" : ""}`}
        />
      ) : (
        <Avatar
          src={avatarSrc}
          name={name}
          alt={name}
          className="h-16 w-16 rounded-full object-cover"
          textClassName="text-xl"
        />
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white">
        {isAudioMuted && <FiMicOff size={12} />}
        <span className="max-w-[8rem] truncate">{isLocal ? "You" : name}</span>
      </div>
    </div>
  );
};

interface CallVideoGridProps {
  localStream: MediaStream | null;
  localUserName: string;
  localAvatar?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  callType: CallType;
  participants: CallParticipantInfo[];
}

// Built for 1..6 tiles from the start (the group call cap), so group call UI
// (Phase 4) reuses this unchanged.
const CallVideoGrid = ({
  localStream,
  localUserName,
  localAvatar,
  isMuted,
  isCameraOff,
  callType,
  participants,
}: CallVideoGridProps) => {
  const tileCount = participants.length + 1;
  const gridColsClass =
    tileCount <= 1
      ? "grid-cols-1"
      : tileCount <= 2
        ? "grid-cols-1 sm:grid-cols-2"
        : tileCount <= 4
          ? "grid-cols-2"
          : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid w-full max-w-5xl gap-3 ${gridColsClass}`}>
      <VideoTile
        stream={localStream}
        muted
        isVideoActive={callType === "video" && !isCameraOff}
        isAudioMuted={isMuted}
        name={localUserName}
        avatarSrc={localAvatar}
        isLocal
      />
      {participants.map((participant) => (
        <VideoTile
          key={participant.userId}
          stream={participant.stream}
          isVideoActive={callType === "video" && participant.videoEnabled}
          isAudioMuted={!participant.audioEnabled}
          name={participant.userName}
          avatarSrc={participant.profilePic}
        />
      ))}
    </div>
  );
};

export default CallVideoGrid;
