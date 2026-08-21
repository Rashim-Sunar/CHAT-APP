import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import Avatar from "../Avatar";
import { colors } from "../../constants/theme";
import type { StoryGroup, StoryItem } from "../../types";

const STORY_DURATION_MS = 5000;

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

const backgroundMap: Record<string, string> = {
  "purple-gradient": "#4f46e5",
  "night-gradient": "#020617",
  "sunset-gradient": "#f43f5e",
};

export default function StoryViewer({
  open,
  group,
  initialStoryIndex,
  currentUserId,
  onClose,
  onMarkViewed,
  onDeleteStory,
  onAddStory,
}: StoryViewerProps) {
  const videoRef = useRef<Video | null>(null);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const stories = group?.stories || [];
  const currentStory: StoryItem | null = stories[storyIndex] || null;
  const isOwn = Boolean(currentStory && String(currentStory.userId) === String(currentUserId));

  useEffect(() => {
    if (!open) return;
    setStoryIndex(Math.min(initialStoryIndex, Math.max(0, stories.length - 1)));
  }, [open, initialStoryIndex, stories.length]);

  useEffect(() => {
    if (!open || !currentStory) return;

    setProgress(0);
    setVideoDuration(null);

    if (!currentStory.viewedByMe && !currentStory.isOwn) {
      void onMarkViewed(currentStory._id);
    }
  }, [open, currentStory?._id]);

  useEffect(() => {
    if (!open || !currentStory) return;

    if (currentStory.type !== "video") {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const nextProgress = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
        setProgress(nextProgress);
        if (nextProgress >= 100) {
          clearInterval(timer);
          handleNext();
        }
      }, 40);

      return () => clearInterval(timer);
    }

    return undefined;
  }, [open, currentStory?._id]);

  useEffect(() => {
    return () => {
      videoRef.current?.pauseAsync().catch(() => undefined);
    };
  }, [currentStory?._id]);

  const canGoPrevious = storyIndex > 0;
  const canGoNext = storyIndex < stories.length - 1;

  const handlePrevious = () => {
    if (!canGoPrevious) return;
    setStoryIndex((index) => Math.max(0, index - 1));
  };

  const handleNext = () => {
    if (canGoNext) {
      setStoryIndex((index) => Math.min(stories.length - 1, index + 1));
      return;
    }

    onClose();
  };

  const storyTimestamp = useMemo(() => {
    if (!currentStory) return "";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(
      new Date(currentStory.createdAt)
    );
  }, [currentStory]);

  if (!open || !group || !currentStory) return null;

  const storyContent = (() => {
    if (currentStory.type === "text") {
      return (
        <View
          style={[
            styles.textCard,
            { backgroundColor: backgroundMap[currentStory.background || "purple-gradient"] || backgroundMap["purple-gradient"] },
            currentStory.textAlign === "left"
              ? { alignItems: "flex-start" }
              : currentStory.textAlign === "right"
                ? { alignItems: "flex-end" }
                : { alignItems: "center" },
          ]}
        >
          <Text style={[styles.storyText, { textAlign: currentStory.textAlign || "center" }]}>{currentStory.text}</Text>
        </View>
      );
    }

    if (currentStory.type === "video") {
      return (
        <Video
          ref={videoRef}
          source={{ uri: currentStory.mediaUrl || undefined }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (!status.isLoaded) return;
            if (status.durationMillis) {
              setProgress(Math.min(100, (status.positionMillis / status.durationMillis) * 100));
            }
            if (status.didJustFinish) {
              handleNext();
            }
            if (status.isLoaded && !videoDuration && status.durationMillis) {
              setVideoDuration(status.durationMillis);
            }
          }}
        />
      );
    }

    return <View style={styles.media}><Text style={styles.mediaImageFallback}>Loading image...</Text></View>;
  })();

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.progressRow}>
          {stories.map((item, index) => (
            <View key={item._id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: index < storyIndex ? "100%" : index > storyIndex ? "0%" : `${Math.max(0, Math.min(100, progress))}%` },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar id={currentStory.user._id} name={currentStory.user.userName} uri={currentStory.user.profilePic} gender={currentStory.user.gender} size={40} />
            <View style={styles.headerTextWrap}>
              <Text style={styles.userName}>{currentStory.user.userName}</Text>
              <Text style={styles.timeText}>{storyTimestamp}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isOwn && onAddStory && (
              <TouchableOpacity onPress={onAddStory} style={styles.iconButton}>
                <Ionicons name="add" size={18} color={colors.surface} />
              </TouchableOpacity>
            )}
            {isOwn && onDeleteStory && (
              <TouchableOpacity onPress={() => void onDeleteStory(currentStory._id)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={18} color={colors.surface} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={20} color={colors.surface} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.viewerArea}>
          <Pressable style={styles.hitLeft} onPress={handlePrevious} />
          <Pressable style={styles.hitRight} onPress={handleNext} />
          {currentStory.type === "video" ? (
            storyContent
          ) : currentStory.type === "image" ? (
            <ImageContent uri={currentStory.mediaUrl || undefined} />
          ) : (
            storyContent
          )}
        </View>

        {currentStory.caption ? <Text style={styles.caption}>{currentStory.caption}</Text> : null}

        <View style={styles.replyBox}>
          <Text style={styles.replyText}>Add a reply...</Text>
        </View>

        <Text style={styles.helpText}>Tap the right side to advance, left side to go back</Text>
      </View>
    </Modal>
  );
}

function ImageContent({ uri }: { uri?: string }) {
  if (!uri) {
    return (
      <View style={[styles.media, styles.imageFallback]}>
        <Text style={styles.mediaImageFallback}>Image unavailable</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.image} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" , paddingTop: 12, paddingHorizontal: 12, paddingBottom: 12},
  progressRow: { flexDirection: "row", gap: 4, marginBottom: 10 },
  progressTrack: { flex: 1, height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerTextWrap: { flex: 1, minWidth: 0 },
  userName: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  timeText: { color: "rgba(255,255,255,0.68)", fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  viewerArea: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  hitLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", zIndex: 2 },
  hitRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", zIndex: 2 },
  media: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  image: { width: "100%", height: "100%", backgroundColor: "#000" },
  imageFallback: { backgroundColor: "#000" },
  mediaImageFallback: { color: colors.surface, fontSize: 14, fontWeight: "600" },
  textCard: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 },
  storyText: { color: colors.surface, fontSize: 30, fontWeight: "700", lineHeight: 38, maxWidth: "100%" },
  caption: { marginTop: 12, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, color: colors.surface, fontSize: 13 },
  replyBox: { marginTop: 12, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  replyText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  helpText: { textAlign: "center", marginTop: 10, color: "rgba(255,255,255,0.35)", fontSize: 11 },
});
