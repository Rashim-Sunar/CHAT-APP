import { useEffect, useRef, useState } from "react";
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
  avatarClassName?: string;
  showLabel?: boolean;
}

/**
 * The <video> element stays mounted whenever a stream exists, even for
 * audio-only calls or a camera that's off — unmounting it detaches the
 * remote MediaStream and silences that participant's audio. The avatar is
 * layered on top instead of replacing it.
 */
const VideoTile = ({
  stream,
  muted,
  isVideoActive,
  isAudioMuted,
  name,
  avatarSrc,
  isLocal,
  avatarClassName = "h-16 w-16",
  showLabel = true,
}: VideoTileProps) => {
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
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-800">
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${isLocal ? "-scale-x-100" : ""}`}
        />
      )}

      {(!stream || !isVideoActive) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <Avatar
            src={avatarSrc}
            name={name}
            alt={name}
            className={`${avatarClassName} rounded-full object-cover`}
            textClassName="text-xl"
          />
        </div>
      )}

      {showLabel && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white">
          {isAudioMuted && <FiMicOff size={12} />}
          <span className="max-w-[8rem] truncate">{isLocal ? "You" : name}</span>
        </div>
      )}
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

const CallVideoGrid = ({
  localStream,
  localUserName,
  localAvatar,
  isMuted,
  isCameraOff,
  callType,
  participants,
}: CallVideoGridProps) => {
  // Which feed occupies the large surface in a 1:1 call; clicking the small
  // tile flips it, the same affordance mobile uses.
  const [swapped, setSwapped] = useState(false);

  const isVideoCall = callType === "video";
  const remote = participants[0];
  const isOneToOne = participants.length <= 1;

  const localTile = {
    stream: localStream,
    isVideoActive: isVideoCall && !isCameraOff,
    isAudioMuted: isMuted,
    name: localUserName,
    avatarSrc: localAvatar,
    isLocal: true,
    muted: true,
  };

  const remoteTile = remote
    ? {
        stream: remote.stream,
        isVideoActive: isVideoCall && remote.videoEnabled,
        isAudioMuted: !remote.audioEnabled,
        name: remote.userName,
        avatarSrc: remote.profilePic,
        isLocal: false,
        muted: false,
      }
    : null;

  if (isOneToOne) {
    // Before anyone joins, a video call previews the local camera large.
    const bigIsLocal = remoteTile ? swapped : isVideoCall;
    const big = bigIsLocal ? localTile : remoteTile ?? localTile;
    const small = bigIsLocal ? remoteTile : localTile;

    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-800">
        <VideoTile {...big} avatarClassName="h-28 w-28" showLabel={false} />

        {remoteTile && small && (
          <button
            type="button"
            onClick={() => setSwapped((previous) => !previous)}
            aria-label="Swap videos"
            className="absolute right-4 top-4 h-40 w-28 overflow-hidden rounded-xl border border-white/20 shadow-lg transition-transform hover:scale-[1.03]"
          >
            <VideoTile {...small} avatarClassName="h-12 w-12" />
          </button>
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
          {big.isAudioMuted && <FiMicOff size={12} />}
          <span className="max-w-[10rem] truncate">{big.isLocal ? "You" : big.name}</span>
        </div>
      </div>
    );
  }

  const tileCount = participants.length + 1;
  const gridColsClass = tileCount <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid w-full max-w-5xl gap-3 ${gridColsClass}`}>
      <div className="aspect-video overflow-hidden rounded-xl">
        <VideoTile {...localTile} />
      </div>
      {participants.map((participant) => (
        <div key={participant.userId} className="aspect-video overflow-hidden rounded-xl">
          <VideoTile
            stream={participant.stream}
            isVideoActive={isVideoCall && participant.videoEnabled}
            isAudioMuted={!participant.audioEnabled}
            name={participant.userName}
            avatarSrc={participant.profilePic}
          />
        </div>
      ))}
    </div>
  );
};

export default CallVideoGrid;
