import { BiPin } from "react-icons/bi";
import usePinnedMessages from "../../hooks/usePinnedMessages";
import { getMessageBodyText } from "../../Utils/messageDisplay";
import { scrollToMessage } from "../../Utils/scrollToMessage";

// Slim bar between the conversation header and the message list — same slot
// GroupCallBanner uses. Shows the most-recently-pinned message; clicking
// jumps to it in the thread. Hidden when there are no pins.
const PinnedMessageBanner = () => {
  const { pinnedMessages } = usePinnedMessages();

  if (pinnedMessages.length === 0) return null;

  const latest = pinnedMessages[0];
  const snippet = latest.deletedForEveryone ? null : getMessageBodyText(latest) || "Media message";
  if (!snippet) return null;

  return (
    <button
      type="button"
      onClick={() => latest._id && scrollToMessage(latest._id)}
      className="flex w-full items-center gap-2.5 border-b border-indigo-100 bg-indigo-50 px-4 md:px-6 py-2 text-left transition-colors hover:bg-indigo-100"
    >
      <BiPin size={16} className="shrink-0 text-indigo-600" />
      <span className="min-w-0 flex-1 truncate text-sm text-indigo-700">{snippet}</span>
      {pinnedMessages.length > 1 && (
        <span className="shrink-0 text-xs font-medium text-indigo-500">{pinnedMessages.length} pinned</span>
      )}
    </button>
  );
};

export default PinnedMessageBanner;
