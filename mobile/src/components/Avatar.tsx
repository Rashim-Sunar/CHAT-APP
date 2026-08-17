import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { avatarColorForId, colors } from "../constants/theme";
import type { Gender } from "../types";

// Bundled fallback portraits — mirrors the web app's three-tier Avatar
// (real photo -> gender default -> initials); see
// frontend/src/components/common/Avatar.tsx and Utils/getAvatarByGender.ts.
const MALE_AVATAR = require("../../assets/avatars/male.png");
const FEMALE_AVATAR = require("../../assets/avatars/female.jpg");

interface AvatarProps {
  id: string;
  name: string;
  uri?: string;
  gender?: Gender | string | null;
  size?: number;
  online?: boolean;
}

export default function Avatar({ id, name, uri, gender, size = 44, online = false }: AvatarProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [genderAvatarFailed, setGenderAvatarFailed] = useState(false);
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };
  const dotSize = Math.max(10, Math.round(size * 0.28));

  const showPhoto = Boolean(uri) && !photoFailed;
  const showGenderAvatar = !showPhoto && Boolean(gender) && !genderAvatarFailed;
  const normalizedGender = gender ? String(gender).toLowerCase() : "";
  const genderAvatarSource = normalizedGender === "female" || normalizedGender === "f" ? FEMALE_AVATAR : MALE_AVATAR;

  return (
    <View style={{ width: size, height: size }}>
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={[styles.image, dimensionStyle]}
          onError={() => setPhotoFailed(true)}
        />
      ) : showGenderAvatar ? (
        <Image
          source={genderAvatarSource}
          style={[styles.image, dimensionStyle]}
          onError={() => setGenderAvatarFailed(true)}
        />
      ) : (
        <View style={[styles.fallback, dimensionStyle, { backgroundColor: avatarColorForId(id) }]}>
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{(name || "?").charAt(0).toUpperCase()}</Text>
        </View>
      )}
      {online && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: Math.max(1.5, dotSize * 0.18),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: colors.online,
    borderColor: colors.surface,
  },
});
