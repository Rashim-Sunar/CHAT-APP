import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { FiSmile } from "react-icons/fi";
import type { EmojiClickData } from "emoji-picker-react";

// Dynamically imported so the emoji dataset (bundled with emoji-picker-react)
// is code-split out of the main bundle and only fetched when someone actually
// opens the picker, rather than on every page load.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface MessageReactionBarProps {
  onSelectEmoji: (emoji: string) => void;
  align: "left" | "right";
}

// Hover-revealed reaction trigger + full emoji picker popover, positioned
// near the message bubble it's attached to.
const MessageReactionBar = ({ onSelectEmoji, align }: MessageReactionBarProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isPickerOpen]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelectEmoji(emojiData.emoji);
    setIsPickerOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsPickerOpen((current) => !current)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition duration-200 hover:bg-slate-100 group-hover:opacity-100 focus:opacity-100"
        aria-label="React to message"
      >
        <FiSmile size={14} />
      </button>

      {isPickerOpen && (
        <div className={`absolute top-full z-30 mt-2 ${align === "right" ? "right-0" : "left-0"}`}>
          <Suspense
            fallback={
              <div className="flex h-[360px] w-[300px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400 shadow-lg">
                Loading…
              </div>
            }
          >
            <EmojiPicker onEmojiClick={handleEmojiClick} height={360} width={300} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default MessageReactionBar;
