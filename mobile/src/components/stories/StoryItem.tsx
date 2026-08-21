import { Pressable, StyleSheet, Text, View } from "react-native";
import Avatar from "../Avatar";
import { colors } from "../../constants/theme";
import type { StoryGroup } from "../../types";

interface StoryItemProps {
  group: StoryGroup;
  currentUserId?: string;
  onPress: () => void;
}

export default function StoryItem({ group, currentUserId, onPress }: StoryItemProps) {
  const isOwn = group.user._id === currentUserId;
  const hasStories = group.stories.length > 0;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.ring, group.hasUnseenStory ? styles.ringUnseen : styles.ringSeen]}>
        <View style={styles.avatarWrap}>
          <Avatar id={group.user._id} name={group.user.userName} uri={group.user.profilePic} gender={group.user.gender} size={52} />
          {isOwn && !hasStories && <View style={styles.plusBadge}><Text style={styles.plusText}>+</Text></View>}
        </View>
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {isOwn ? "Your story" : group.user.userName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: 72, alignItems: "center", gap: 6 },
  ring: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", padding: 2 },
  ringUnseen: { backgroundColor: colors.primary },
  ringSeen: { backgroundColor: colors.border },
  avatarWrap: { position: "relative", width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: colors.surface },
  plusBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: { color: colors.surface, fontSize: 11, fontWeight: "700", lineHeight: 12 },
  label: { width: 72, textAlign: "center", fontSize: 11, fontWeight: "500", color: colors.textMuted },
});
