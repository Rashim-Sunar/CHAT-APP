import { apiFetch } from "../Utils/apiFetch";
import type {
  StoryCreatePayload,
  StoryGroup,
  StoryItem,
  StoryUploadSignatureResponse,
  StoriesResponse,
  UploadSignatureResponse,
} from "../types";

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

const uploadWithProgress = ({
  file,
  signaturePayload,
  onProgress,
}: {
  file: File;
  signaturePayload: UploadSignatureResponse;
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
    formData.append("file", file);
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

export const getStoryById = async (storyId: string): Promise<StoryItem> => {
  const response = await apiFetch<{ status: string; data?: { story: StoryItem } }>(`/stories/${storyId}`);
  if (!response.data?.story) {
    throw new Error("Story not found");
  }

  return response.data.story;
};

export const getStoryUploadSignature = async (file: File): Promise<StoryUploadSignatureResponse> => {
  const response = await apiFetch<{ status?: string; data?: StoryUploadSignatureResponse; error?: string }>(
    "/stories/upload-signature",
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }),
    }
  );

  if (!response.data) {
    throw new Error(response.error || "Failed to get story upload signature");
  }

  return response.data;
};

export const uploadStoryMediaToCloudinary = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<Pick<StoryCreatePayload, "mediaUrl" | "publicId" | "fileName" | "fileSize" | "mimeType" | "type">> => {
  const signature = await getStoryUploadSignature(file);

  const cloudinaryResult = await uploadWithProgress({
    file,
    signaturePayload: signature,
    onProgress,
  });

  return {
    type: signature.resourceType === "image" ? "image" : "video",
    mediaUrl: cloudinaryResult.secure_url,
    publicId: cloudinaryResult.public_id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
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
