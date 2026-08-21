import { apiFetch } from "./client";

export type ResourceType = "image" | "video" | "raw";

interface UploadSignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  resourceType: ResourceType;
  accessMode?: string;
  error?: string;
}

export interface LocalAsset {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface UploadedAsset {
  messageType: "image" | "video" | "file";
  fileUrl: string;
  publicId: string;
  fileName: string;
  fileSize?: number;
  mimeType: string;
}

const resolveResourceType = (mimeType: string): ResourceType => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "raw";
};

const messageTypeFor = (resourceType: ResourceType): UploadedAsset["messageType"] => {
  if (resourceType === "image") return "image";
  if (resourceType === "video") return "video";
  return "file";
};

// The backend signs each upload so the raw file can go straight to Cloudinary
// without passing through our server.
export const uploadAsset = async (asset: LocalAsset): Promise<UploadedAsset> => {
  const signature = await apiFetch<UploadSignatureResponse>("/messages/upload-signature", {
    method: "POST",
    body: JSON.stringify({
      fileName: asset.name,
      mimeType: asset.mimeType,
      fileSize: asset.size,
    }),
  });

  if (signature.error) {
    throw new Error(signature.error);
  }

  const resourceType = resolveResourceType(asset.mimeType) || signature.resourceType;

  const formData = new FormData();
  // React Native's FormData accepts this descriptor in place of a File object.
  formData.append("file", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType,
  } as unknown as Blob);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("public_id", signature.publicId);
  formData.append("access_mode", signature.accessMode || "public");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const result = (await response.json()) as { secure_url: string; public_id: string };

  return {
    messageType: messageTypeFor(resourceType),
    fileUrl: result.secure_url,
    publicId: result.public_id,
    fileName: asset.name,
    fileSize: asset.size,
    mimeType: asset.mimeType,
  };
};
