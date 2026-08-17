import { Image, StyleSheet, Text, View } from "react-native";
import { avatarColorForId, colors } from "../constants/theme";

interface AvatarProps {
  id: string;
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
}

export default function Avatar({ id, name, uri, size = 44, online = false }: AvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, dimensionStyle]} />
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
