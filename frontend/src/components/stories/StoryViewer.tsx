import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BiArrowBack, BiTrash, BiX } from "react-icons/bi";
import Avatar from "../common/Avatar";
import type { StoryGroup, StoryItem } from "../../types";

interface StoryViewerProps {
  open: boolean;
  group: StoryGroup | null;
  initialStoryIndex: number;
  currentUserId?: string;
  onClose: () => void;
  onMarkViewed: (storyId: string) => Promise<void>;
  onDeleteStory?: (storyId: string) => Promise<void>;
  onAddStory?: () => void;
}

const STORY_DURATION_MS = 5000;

const backgroundMap: Record<string, string> = {
  "purple-gradient": "bg-gradient-to-br from-indigo-700 via-violet-600 to-fuchsia-500",
  "night-gradient": "bg-gradient-to-br from-slate-950 via-slate-800 to-indigo-900",
  "sunset-gradient": "bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600",
};

const StoryViewer = ({
  open,
  group,
  initialStoryIndex,
  currentUserId,
  onClose,
  onMarkViewed,
  onDeleteStory,
  onAddStory,
}: StoryViewerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);

  const stories = group?.stories || [];
  const currentStory: StoryItem | null = stories[storyIndex] || null;
  const isOwn = Boolean(currentStory && String(currentStory.userId) === String(currentUserId));

  const canGoPrevious = storyIndex > 0;
  const canGoNext = storyIndex < stories.length - 1;

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) return;
    setStoryIndex((index) => Math.max(0, index - 1));
  }, [canGoPrevious]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      setStoryIndex((index) => Math.min(stories.length - 1, index + 1));
      return;
    }

    onClose();
  }, [canGoNext, onClose, stories.length]);

  useEffect(() => {
    if (!open) return;
    setStoryIndex(Math.min(initialStoryIndex, Math.max(0, stories.length - 1)));
  }, [initialStoryIndex, open, stories.length]);

  useEffect(() => {
    if (!open || !currentStory) return;

    setProgress(0);

    if (!currentStory.viewedByMe && !currentStory.isOwn) {
      void onMarkViewed(currentStory._id);
    }
  }, [currentStory, onMarkViewed, open]);

  useEffect(() => {
    if (!open || !currentStory || currentStory.type === "video") return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        window.clearInterval(timer);
        handleNext();
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [currentStory, handleNext, open]);

  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      if (videoElement) {
        videoElement.pause();
      }
    };
  }, [currentStory]);

  const storyTimestamp = useMemo(() => {
    if (!currentStory) return "";
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(currentStory.createdAt));
  }, [currentStory]);

  if (!open || !group || !currentStory) return null;

  const storyContent = (() => {
    if (currentStory.type === "text") {
      const backgroundClass = backgroundMap[currentStory.background || "purple-gradient"] || backgroundMap["purple-gradient"];

      return (
        <div
          className={`flex h-full w-full items-center justify-center rounded-3xl px-6 py-8 text-white shadow-2xl ${backgroundClass}`}
          style={{ textAlign: currentStory.textAlign || "center" }}
        >
          <div className="max-w-xl text-3xl font-semibold leading-tight md:text-5xl">{currentStory.text}</div>
        </div>
      );
    }

    if (currentStory.type === "video") {
      return (
        <video
          ref={videoRef}
          src={currentStory.mediaUrl || undefined}
          autoPlay
          playsInline
          controls={false}
          className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl"
          onLoadedMetadata={() => setProgress(0)}
          onTimeUpdate={(event) => {
            const duration = event.currentTarget.duration || 0;
            if (!duration) return;
            setProgress(Math.min(100, (event.currentTarget.currentTime / duration) * 100));
          }}
          onEnded={handleNext}
        />
      );
    }

    return (
      <img
        src={currentStory.mediaUrl || undefined}
        alt="Story"
        className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl"
        draggable={false}
      />
    );
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-white">
      <button type="button" className="absolute inset-0 cursor-default" onClick={handleNext} aria-hidden="true" />

      <div className="relative flex h-full w-full max-w-6xl flex-col px-3 py-3 md:px-5 md:py-5">
        <div className="mb-3 flex gap-1.5">
          {stories.map((item, index) => (
            <div key={item._id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all duration-75"
                style={{
                  width:
                    index < storyIndex ? "100%" : index > storyIndex ? "0%" : `${Math.max(0, Math.min(100, progress))}%`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between rounded-2xl bg-black/35 px-4 py-3 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={currentStory.user.profilePic}
              gender={currentStory.user.gender}
              name={currentStory.user.userName}
              alt={currentStory.user.userName}
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentStory.user.userName}</p>
              <p className="text-xs text-white/70">{storyTimestamp}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwn && onAddStory && (
              <button
                type="button"
                onClick={onAddStory}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Add story
              </button>
            )}
            {isOwn && onDeleteStory && (
              <button
                type="button"
                onClick={() => void onDeleteStory(currentStory._id)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/15"
                aria-label="Delete story"
              >
                <BiTrash size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/15">
              <BiX size={20} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-black/25 px-3 py-3 md:px-6 md:py-6">
          <button
            type="button"
            onClick={handlePrevious}
            className="absolute left-0 top-0 h-full w-1/2 cursor-pointer bg-transparent"
            aria-label="Previous story"
          />
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-0 top-0 h-full w-1/2 cursor-pointer bg-transparent"
            aria-label="Next story"
          />

          {storyContent}
        </div>

        {currentStory.caption && (
          <div className="mt-3 rounded-2xl bg-black/35 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
            {currentStory.caption}
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-black/35 px-4 py-3 backdrop-blur-sm">
          <p className="text-sm text-white/70">Add a reply...</p>
        </div>

        <div className="mt-2 text-center text-xs text-white/45">
          Tap the right side to advance, left side to go back
        </div>

        <button
          type="button"
          onClick={handlePrevious}
          className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-xs font-medium text-white/85 backdrop-blur-sm md:hidden"
        >
          <BiArrowBack size={16} />
          Back
        </button>
      </div>
    </div>
  );
};

export default StoryViewer;
