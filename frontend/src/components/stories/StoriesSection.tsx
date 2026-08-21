import { useMemo, useState } from "react";
import { BiChevronRight } from "react-icons/bi";
import useStories from "../../hooks/useStories";
import { useAuthContext } from "../../context/Auth-Context";
import StoryItem from "./StoryItem";
import StoryComposerModal from "./StoryComposerModal";
import StoryViewer from "./StoryViewer";

const StoriesSection = () => {
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const currentUser = authUser?.data?.user;
  const { stories, loading, publishStory, publishStoryMedia, markStoryViewed, removeStory } = useStories();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);

  const displayGroups = useMemo(() => {
    const ownGroup =
      currentUser && currentUserId
        ? stories.find((group) => group.user._id === currentUserId) || {
            user: {
              _id: currentUserId,
              userName: currentUser.userName,
              gender: currentUser.gender,
              profilePic: currentUser.profilePic,
            },
            stories: [],
            hasUnseenStory: false,
            latestStoryAt: "",
          }
        : null;

    const rest = stories.filter((group) => group.user._id !== currentUserId);
    return ownGroup ? [ownGroup, ...rest] : rest;
  }, [stories, currentUser, currentUserId]);

  const openViewer = (groupIndex: number, storyIndex = 0) => {
    setViewerGroupIndex(groupIndex);
    setViewerStoryIndex(storyIndex);
  };

  const openMyStory = () => {
    const ownGroupIndex = displayGroups.findIndex((group) => group.user._id === currentUserId);

    if (ownGroupIndex >= 0 && displayGroups[ownGroupIndex]?.stories.length > 0) {
      openViewer(ownGroupIndex, 0);
      return;
    }

    setComposerOpen(true);
  };

  const activeGroup = viewerGroupIndex !== null ? displayGroups[viewerGroupIndex] || null : null;
  const hasAnyStories = stories.some((group) => group.stories.length > 0);

  return (
    <section className="space-y-3 border-b border-slate-100 px-4 py-4 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Stories</h3>
        </div>

        {hasAnyStories ? (
          <button
            type="button"
            onClick={() => {
              const firstAvailableIndex = stories.findIndex((group) => group.stories.length > 0);
              if (firstAvailableIndex >= 0) {
                openViewer(firstAvailableIndex, 0);
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            See all <BiChevronRight size={14} />
          </button>
        ) : null}
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-indigo-600">
            +
          </span>
          <span className="w-full truncate text-[11px] font-medium text-slate-600">Your story</span>
        </button>

        {loading ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-12 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          displayGroups.map((group, groupIndex) => (
            <StoryItem
              key={group.user._id}
              group={group}
              currentUserId={currentUserId}
              onClick={() => (group.user._id === currentUserId ? openMyStory() : openViewer(groupIndex, 0))}
            />
          ))
        )}
      </div>

      {stories.length === 0 && !loading ? (
        <p className="text-xs text-slate-400">No stories yet. Share a moment with your friends.</p>
      ) : null}

      <StoryComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublishText={publishStory}
        onPublishMedia={publishStoryMedia}
      />

      <StoryViewer
        open={viewerGroupIndex !== null}
        group={activeGroup}
        initialStoryIndex={viewerStoryIndex}
        currentUserId={currentUserId}
        onClose={() => setViewerGroupIndex(null)}
        onMarkViewed={markStoryViewed}
        onDeleteStory={removeStory}
        onAddStory={() => setComposerOpen(true)}
      />
    </section>
  );
};

export default StoriesSection;
