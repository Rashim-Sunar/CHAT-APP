/**
 * User Profile API Handlers
 * -------------------------
 * Centralized API calls for user profile operations including name updates,
 * profile picture uploads, and profile picture deletion.
 *
 * Uses Cloudinary's signed upload approach - client uploads directly to Cloudinary
 * after obtaining signed credentials from backend, then sends URL to backend for storage.
 */

import { apiFetch } from "../Utils/apiFetch";
import type { AuthResponse } from "../types";

/**
 * Update user's name
 * ==================
 * Sends a PATCH request to update the authenticated user's display name.
 *
 * @param {string} userName - The new user name
 * @returns {Promise<AuthResponse>} Updated auth response with new user data
 * @throws {Error} If the API call fails or returns an error
 */
export const updateUserName = async (userName: string): Promise<AuthResponse> => {
  const response = await apiFetch<AuthResponse>("/users/update-name", {
    method: "PATCH",
    body: JSON.stringify({ userName }),
  });

  if (response.status !== "success" || !response.data?.user) {
    throw new Error(response.message || "Failed to update user name");
  }

  return response;
};

/**
 * Get Cloudinary Upload Signature
 * ===============================
 * Requests signed upload credentials from backend to upload profile picture directly to Cloudinary.
 *
 * @returns {Promise<Object>} Upload signature with Cloudinary credentials
 * @throws {Error} If the API call fails
 */
export const getProfilePictureUploadSignature = async () => {
  const response = await apiFetch<{
    status: string;
    data?: {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      publicId: string;
      resourceType: string;
      maxFileSizeBytes: number;
    };
    message?: string;
  }>("/users/upload-profile-pic-signature", {
    method: "POST",
  });

  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Failed to get upload signature");
  }

  return response.data;
};

/**
 * Upload Profile Picture Direct to Cloudinary
 * ============================================
 * Uploads file directly to Cloudinary using signed credentials.
 * Returns the secure URL of the uploaded image.
 *
 * @param {File} file - The profile picture file to upload
 * @param {(progress: number) => void} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<string>} The secure URL of the uploaded image
 * @throws {Error} If the upload fails
 */
export const uploadToCloudinary = async (
  file: File,
  signature: {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
    resourceType: string;
  },
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;

    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as {
            secure_url: string;
          };
          resolve(response.secure_url);
        } catch (error) {
          reject(new Error("Upload succeeded but response parsing failed"));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText) as {
            error?: { message?: string };
          };

          reject(new Error(errorResponse.error?.message || "Cloudinary upload failed"));
        } catch {
          reject(new Error("Cloudinary upload failed"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("public_id", signature.publicId);
    formData.append("folder", "chat-app/profile-pics");

    xhr.send(formData);
  });
};

/**
 * Save Profile Picture URL to Backend
 * ===================================
 * After uploading to Cloudinary, send the URL to backend to save in user document.
 *
 * @param {string} profilePicUrl - The Cloudinary URL of the uploaded picture
 * @returns {Promise<AuthResponse>} Updated auth response with new profile picture
 * @throws {Error} If the API call fails
 */
export const saveProfilePictureUrl = async (profilePicUrl: string): Promise<AuthResponse> => {
  const response = await apiFetch<AuthResponse>("/users/upload-profile-pic", {
    method: "POST",
    body: JSON.stringify({ profilePicUrl }),
  });

  if (response.status !== "success" || !response.data?.user) {
    throw new Error(response.message || "Failed to save profile picture");
  }

  return response;
};

/**
 * Delete user's profile picture
 * =============================
 * Sends a DELETE request to remove the user's current profile picture.
 * User will revert to a default gender-based avatar.
 *
 * @returns {Promise<AuthResponse>} Updated auth response with profilePic removed
 * @throws {Error} If the API call fails
 */
export const deleteProfilePicture = async (): Promise<AuthResponse> => {
  const response = await apiFetch<AuthResponse>("/users/delete-profile-pic", {
    method: "DELETE",
  });

  if (response.status !== "success" || !response.data?.user) {
    throw new Error(response.message || "Failed to delete profile picture");
  }

  return response;
};
