import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { StoryCreatePayload, StoryItem } from "../../types";
import { colors } from "../../constants/theme";

type ComposerMode = "menu" | "text" | "media";

interface StoryComposerModalProps {
  open: boolean;
  onClose: () => void;
  onPublishText: (payload: StoryCreatePayload) => Promise<StoryItem>;
  onPublishMedia: (
    asset: ImagePicker.ImagePickerAsset,
    caption: string,
    privacy: StoryCreatePayload["privacy"],
    onProgress?: (progress: number) => void
  ) => Promise<StoryItem>;
}

const backgrounds = [
  { id: "purple-gradient", colors: ["#4338ca", "#7c3aed", "#d946ef"] },
  { id: "night-gradient", colors: ["#020617", "#1e293b", "#312e81"] },
  { id: "sunset-gradient", colors: ["#f97316", "#f43f5e", "#ec4899"] },
];

export default function StoryComposerModal({ open, onClose, onPublishText, onPublishMedia }: StoryComposerModalProps) {
  const [mode, setMode] = useState<ComposerMode>("menu");
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [storyText, setStoryText] = useState("Share a moment");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [background, setBackground] = useState(backgrounds[0].id);
  const [privacy, setPrivacy] = useState<"everyone" | "close_friends">("everyone");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundStyle = useMemo(
    () => backgrounds.find((entry) => entry.id === background) || backgrounds[0],
    [background]
  );

  const clearState = () => {
    setMode("menu");
    setSelectedAsset(null);
    setCaption("");
    setStoryText("Share a moment");
    setTextAlign("center");
    setBackground(backgrounds[0].id);
    setPrivacy("everyone");
    setUploadProgress(0);
    setPublishing(false);
    setError(null);
  };

  useEffect(() => {
    if (!open) clearState();
  }, [open]);

  const openPicker = async (source: "gallery" | "camera") => {
    setError(null);
    const permissionResult =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      setError(source === "camera" ? "Camera permission is required" : "Media library permission is required");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });

    if (result.canceled || !result.assets[0]) return;

    setSelectedAsset(result.assets[0]);
    setMode("media");
  };

  const handlePublish = async () => {
    setError(null);
    setPublishing(true);

    try {
      if (mode === "text") {
        if (!storyText.trim()) {
          throw new Error("Story text cannot be empty");
        }

        await onPublishText({
          type: "text",
          text: storyText.trim(),
          caption: caption.trim(),
          privacy,
          textAlign,
          background,
        });
        onClose();
        return;
      }

      if (!selectedAsset) {
        throw new Error("Select an image or video first");
      }

      await onPublishMedia(selectedAsset, caption.trim(), privacy, setUploadProgress);
      onClose();
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish story");
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  if (!open) return null;

  const isVideo = selectedAsset?.type === "video";

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Story</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {mode === "menu" && (
            <View style={styles.menuList}>
              <TouchableOpacity style={styles.menuItem} onPress={() => void openPicker("camera")}> 
                <View style={styles.menuIcon}><Ionicons name="camera-outline" size={22} color={colors.primary} /></View>
                <View>
                  <Text style={styles.menuTitle}>Camera</Text>
                  <Text style={styles.menuSubtitle}>Capture a new photo or video</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => void openPicker("gallery")}> 
                <View style={styles.menuIcon}><Ionicons name="image-outline" size={22} color={colors.primary} /></View>
                <View>
                  <Text style={styles.menuTitle}>Gallery</Text>
                  <Text style={styles.menuSubtitle}>Choose an image or video</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setMode("text")}> 
                <View style={styles.menuIcon}><Ionicons name="text-outline" size={22} color={colors.primary} /></View>
                <View>
                  <Text style={styles.menuTitle}>Text Story</Text>
                  <Text style={styles.menuSubtitle}>Create a quick status update</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {mode === "text" && (
            <View style={styles.textLayout}>
              <View
                style={[
                  styles.textPreview,
                  { alignItems: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center" },
                  {
                    backgroundColor:
                      background === "night-gradient" ? "#020617" : background === "sunset-gradient" ? "#f43f5e" : "#4f46e5",
                  },
                ]}
              >
                <TextInput
                  value={storyText}
                  onChangeText={setStoryText}
                  placeholder="Share a moment"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  multiline
                  style={[styles.textInput, { textAlign }]}
                />
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Background</Text>
                <View style={styles.backgroundRow}>
                  {backgrounds.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setBackground(option.id)}
                      style={[
                        styles.backgroundSwatch,
                        { backgroundColor: option.colors[0] },
                        background === option.id && styles.backgroundSwatchActive,
                      ]}
                    />
                  ))}
                </View>

                <Text style={styles.panelTitle}>Alignment</Text>
                <View style={styles.alignmentRow}>
                  {(["left", "center", "right"] as const).map((align) => (
                    <TouchableOpacity
                      key={align}
                      onPress={() => setTextAlign(align)}
                      style={[styles.alignButton, textAlign === align && styles.alignButtonActive]}
                    >
                      <Text style={[styles.alignText, textAlign === align && styles.alignTextActive]}>{align}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {mode === "media" && selectedAsset && (
            <View style={styles.mediaLayout}>
              <View style={styles.mediaPreview}>
                {isVideo ? (
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="play-circle-outline" size={56} color={colors.surface} />
                    <Text style={styles.videoText}>Video preview</Text>
                  </View>
                ) : (
                  <Image source={{ uri: selectedAsset.uri }} style={styles.previewImage} />
                )}
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Add a caption</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Optional caption"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  style={styles.captionInput}
                />

                <Text style={styles.panelTitle}>Who can see this story?</Text>
                <View style={styles.privacyRow}>
                  <TouchableOpacity style={styles.privacyItem} onPress={() => setPrivacy("everyone")}>
                    <Text style={styles.privacyLabel}>Everyone</Text>
                    <View style={[styles.radio, privacy === "everyone" && styles.radioActive]} />
                  </TouchableOpacity>
                  <View style={[styles.privacyItem, styles.privacyDisabled]}>
                    <Text style={styles.privacyLabel}>Close Friends</Text>
                    <View style={styles.radio} />
                  </View>
                </View>

                {uploadProgress > 0 && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${uploadProgress}%` }]} /></View>
                    <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          {mode !== "menu" ? (
            <TouchableOpacity
              onPress={() => {
                setMode("menu");
                setSelectedAsset(null);
              }}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 70 }} />
          )}

          <TouchableOpacity
            onPress={() => void handlePublish()}
            disabled={publishing || (mode === "text" ? !storyText.trim() : !selectedAsset)}
            style={[
              styles.publishButton,
              (publishing || (mode === "text" ? !storyText.trim() : !selectedAsset)) && styles.publishButtonDisabled,
            ]}
          >
            {publishing ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.publishButtonText}>Publish</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  menuList: { gap: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 18, padding: 14, backgroundColor: colors.surface },
  menuIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  menuTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  menuSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  textLayout: { gap: 14 },
  textPreview: { minHeight: 280, borderRadius: 24, padding: 18, justifyContent: "center" },
  textInput: { minHeight: 180, color: colors.surface, fontSize: 28, fontWeight: "700" },
  panel: { borderRadius: 22, backgroundColor: "#f8fafc", padding: 14, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  panelTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  backgroundRow: { flexDirection: "row", gap: 10 },
  backgroundSwatch: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  backgroundSwatchActive: { borderColor: colors.text },
  alignmentRow: { flexDirection: "row", gap: 8 },
  alignButton: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  alignButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  alignText: { fontSize: 13, fontWeight: "600", color: colors.textMuted, textTransform: "capitalize" },
  alignTextActive: { color: colors.primary },
  mediaLayout: { gap: 14 },
  mediaPreview: { borderRadius: 24, overflow: "hidden", backgroundColor: colors.text, minHeight: 320, alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: 320 },
  videoPlaceholder: { height: 320, width: "100%", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#0f172a" },
  videoText: { color: colors.surface, fontSize: 14, fontWeight: "600" },
  captionInput: { minHeight: 92, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, color: colors.text, textAlignVertical: "top" },
  privacyRow: { gap: 10 },
  privacyItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12 },
  privacyDisabled: { opacity: 0.55 },
  privacyLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.borderStrong },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  progressWrap: { gap: 6 },
  progressBar: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
  progressText: { fontSize: 12, color: colors.textMuted },
  error: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, backgroundColor: colors.dangerBackground, color: colors.danger, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontWeight: "500" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  backButton: { minWidth: 70, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  backButtonText: { fontSize: 13, fontWeight: "600", color: colors.text },
  publishButton: { minWidth: 104, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center" },
  publishButtonDisabled: { opacity: 0.6 },
  publishButtonText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
});
