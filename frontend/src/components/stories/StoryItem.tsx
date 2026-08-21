import Avatar from "../common/Avatar";
import type { StoryGroup } from "../../types";

interface StoryItemProps {
  group: StoryGroup;
  currentUserId?: string;
  onClick: () => void;
}

const StoryItem = ({ group, currentUserId, onClick }: StoryItemProps) => {
  const isOwn = group.user._id === currentUserId;
  const hasStories = group.stories.length > 0;
  const ringClass = group.hasUnseenStory
    ? "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500"
    : "bg-slate-200";

  return (
    <button type="button" onClick={onClick} className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full p-[2px] ${ringClass}`}>
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
          <Avatar
            src={group.user.profilePic}
            gender={group.user.gender}
            name={group.user.userName}
            alt={group.user.userName}
            className="h-full w-full rounded-full object-cover"
          />
          {isOwn && !hasStories && (
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-[11px] font-bold text-white">
              +
            </span>
          )}
        </span>
      </span>

      <span className="w-full truncate text-[11px] font-medium text-slate-600">
        {isOwn ? "Your story" : group.user.userName}
      </span>
    </button>
  );
};

export default StoryItem;
