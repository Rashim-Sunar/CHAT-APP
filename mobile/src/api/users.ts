import { apiFetch } from "./client";
import type { User } from "../types";

// No dedicated contact-search endpoint exists yet — this is the same flat
// user list the web app used before it moved to conversation-centric APIs.
export const listUsers = async (): Promise<User[]> => {
  const response = await apiFetch<{ status: string; data?: { users: User[] } }>("/users");
  return response.data?.users || [];
};

interface ProfilePicSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
}

// The profile-picture upload uses its own signing endpoint (and its own
// Cloudinary folder) rather than the shared message-attachment one.
export const uploadProfilePicture = async (asset: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<User> => {
  const signatureResponse = await apiFetch<{ status: string; data?: ProfilePicSignature }>(
    "/users/upload-profile-pic-signature",
    { method: "POST" }
  );

  const signature = signatureResponse.data;
  if (!signature) {
    throw new Error("Failed to prepare the upload");
  }

  const formData = new FormData();
  formData.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType } as unknown as Blob);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("public_id", signature.publicId);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!uploadResponse.ok) {
    throw new Error("Upload failed");
  }

  const result = (await uploadResponse.json()) as { secure_url: string };

  const saveResponse = await apiFetch<{ status: string; message?: string; data?: { user: User } }>(
    "/users/upload-profile-pic",
    { method: "POST", body: JSON.stringify({ profilePicUrl: result.secure_url }) }
  );

  if (!saveResponse.data?.user) {
    throw new Error(saveResponse.message || "Failed to save profile picture");
  }

  return saveResponse.data.user;
};

export const updateUserName = async (userName: string): Promise<User> => {
  const response = await apiFetch<{ status: string; message?: string; data?: { user: User } }>(
    "/users/update-name",
    { method: "PATCH", body: JSON.stringify({ userName }) }
  );

  if (!response.data?.user) {
    throw new Error(response.message || "Failed to update username");
  }

  return response.data.user;
};
