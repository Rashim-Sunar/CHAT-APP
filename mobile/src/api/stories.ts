import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "./client";
import type {
  StoryCreatePayload,
  StoryGroup,
  StoryItem,
  StoryUploadSignatureResponse,
  StoriesResponse,
} from "../types";

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

const uploadWithProgress = ({
  asset,
  signaturePayload,
  onProgress,
}: {
  asset: ImagePicker.ImagePickerAsset;
  signaturePayload: StoryUploadSignatureResponse;
  onProgress?: (progress: number) => void;
}) =>
  new Promise<CloudinaryUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/${signaturePayload.resourceType}/upload`;

    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResponse);
        } catch {
          reject(new Error("Upload succeeded but response parsing failed"));
        }
        return;
      }

      reject(new Error("Cloudinary upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      type: asset.mimeType || "application/octet-stream",
      name: asset.fileName || `story-${Date.now()}`,
    } as never);
    formData.append("api_key", signaturePayload.apiKey);
    formData.append("timestamp", String(signaturePayload.timestamp));
    formData.append("signature", signaturePayload.signature);
    formData.append("public_id", signaturePayload.publicId);
    formData.append("access_mode", signaturePayload.accessMode || "public");

    xhr.send(formData);
  });

export const getStories = async (): Promise<StoryGroup[]> => {
  const response = await apiFetch<StoriesResponse>("/stories");
  return response.data?.stories || [];
};

export const getStoryUploadSignature = async (
  asset: ImagePicker.ImagePickerAsset
): Promise<StoryUploadSignatureResponse> => {
  const response = await apiFetch<{ status?: string; data?: StoryUploadSignatureResponse; error?: string }>(
    "/stories/upload-signature",
    {
      method: "POST",
      body: JSON.stringify({
        fileName: asset.fileName || `story-${Date.now()}`,
        mimeType: asset.mimeType || "application/octet-stream",
        fileSize: asset.fileSize || 0,
      }),
    }
  );

  if (!response.data) {
    throw new Error(response.error || "Failed to get story upload signature");
  }

  return response.data;
};

export const uploadStoryMediaToCloudinary = async (
  asset: ImagePicker.ImagePickerAsset,
  onProgress?: (progress: number) => void
): Promise<Pick<StoryCreatePayload, "mediaUrl" | "publicId" | "fileName" | "fileSize" | "mimeType" | "type">> => {
  const signature = await getStoryUploadSignature(asset);

  const cloudinaryResult = await uploadWithProgress({
    asset,
    signaturePayload: signature,
    onProgress,
  });

  return {
    type: signature.resourceType === "image" ? "image" : "video",
    mediaUrl: cloudinaryResult.secure_url,
    publicId: cloudinaryResult.public_id,
    fileName: asset.fileName || `story-${Date.now()}`,
    fileSize: asset.fileSize || 0,
    mimeType: asset.mimeType || "application/octet-stream",
  };
};

export const createStory = async (payload: StoryCreatePayload): Promise<StoryItem> => {
  const response = await apiFetch<{ status: string; data?: { story: StoryItem }; error?: string }>("/stories", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.data?.story) {
    throw new Error(response.error || "Failed to create story");
  }

  return response.data.story;
};

export const viewStory = async (storyId: string): Promise<void> => {
  await apiFetch(`/stories/${storyId}/view`, { method: "POST" });
};

export const deleteStory = async (storyId: string): Promise<void> => {
  await apiFetch(`/stories/${storyId}`, { method: "DELETE" });
};
