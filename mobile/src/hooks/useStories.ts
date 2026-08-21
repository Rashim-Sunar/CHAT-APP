import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";
import {
  createStory,
  deleteStory,
  getStories,
  uploadStoryMediaToCloudinary,
  viewStory,
} from "../api/stories";
import type { StoryCreatePayload, StoryGroup, StoryItem } from "../types";

const useStories = () => {
  const { socket } = useSocketContext();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStories = useCallback(async () => {
    if (!currentUserId) return;

    setRefreshing(true);
    try {
      const nextStories = await getStories();
      setStories(nextStories);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    void refreshStories();
  }, [currentUserId, refreshStories]);

  useEffect(() => {
    if (!socket) return;

    const handleStoryMutation = () => {
      void refreshStories();
    };

    socket.on("story:created", handleStoryMutation);
    socket.on("story:viewed", handleStoryMutation);
    socket.on("story:deleted", handleStoryMutation);

    return () => {
      socket.off("story:created", handleStoryMutation);
      socket.off("story:viewed", handleStoryMutation);
      socket.off("story:deleted", handleStoryMutation);
    };
  }, [socket, refreshStories]);

  const publishStory = async (payload: StoryCreatePayload): Promise<StoryItem> => {
    const story = await createStory(payload);
    await refreshStories();
    return story;
  };

  const publishStoryMedia = async (
    asset: Parameters<typeof uploadStoryMediaToCloudinary>[0],
    caption: string,
    privacy: StoryCreatePayload["privacy"],
    onProgress?: (progress: number) => void
  ): Promise<StoryItem> => {
    const mediaPayload = await uploadStoryMediaToCloudinary(asset, onProgress);
    return publishStory({ ...mediaPayload, caption, privacy });
  };

  const markStoryViewed = async (storyId: string): Promise<void> => {
    await viewStory(storyId);
    void refreshStories();
  };

  const removeStory = async (storyId: string): Promise<void> => {
    await deleteStory(storyId);
    await refreshStories();
  };

  return {
    stories,
    loading,
    refreshing,
    refreshStories,
    publishStory,
    publishStoryMedia,
    markStoryViewed,
    removeStory,
  };
};

export default useStories;
