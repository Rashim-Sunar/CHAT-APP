import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import useStories from "../../hooks/useStories";
import { useAuthContext } from "../../context/AuthContext";
import { colors } from "../../constants/theme";
import StoryItem from "./StoryItem";
import StoryComposerModal from "./StoryComposerModal";
import StoryViewer from "./StoryViewer";

export default function StoriesSection() {
  const { authUser } = useAuthContext();
  const currentUser = authUser?.data?.user;
  const currentUserId = currentUser?._id;
  const { stories, loading, publishStory, publishStoryMedia, markStoryViewed, removeStory } = useStories();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
        <Pressable
          onPress={() => {
            const firstIndex = displayGroups.findIndex((group) => group.stories.length > 0);
            if (firstIndex >= 0) {
              openViewer(firstIndex, 0);
            }
          }}
          hitSlop={8}
          style={styles.seeAll}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <View key={index} style={styles.skeleton} />)
        ) : (
          <>
            {displayGroups.map((group, index) => (
              <StoryItem
                key={group.user._id}
                group={group}
                currentUserId={currentUserId}
                onPress={() => (group.user._id === currentUserId ? openMyStory() : openViewer(index, 0))}
              />
            ))}
          </>
        )}
      </ScrollView>

      {stories.length === 0 && !loading ? <Text style={styles.empty}>No stories yet. Share a moment with your friends.</Text> : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 10, paddingBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 0.7, textTransform: "uppercase" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  row: { paddingHorizontal: 16, gap: 12 },
  skeleton: { width: 72, height: 80, borderRadius: 20, backgroundColor: colors.border },
  empty: { paddingHorizontal: 16, marginTop: 8, fontSize: 12, color: colors.textFaint },
});
