/**
 * useUserProfile Hook
 * -------------------
 * Custom hook for managing user profile operations including name updates,
 * profile picture uploads, and deletions.
 *
 * Handles:
 * - API calls with proper error handling
 * - Auth context updates
 * - Loading and error states
 * - Progress tracking for uploads
 * - Cloudinary signed upload workflow
 *
 * @hook
 * @returns {Object} Profile operations and state
 * @returns {boolean} Loading - Whether an operation is in progress
 * @returns {string | null} Error - Current error message if any
 * @returns {(name: string) => Promise<void>} updateName - Update user name
 * @returns {(file: File, onProgress?: (p: number) => void) => Promise<void>} updateProfilePicture - Upload new picture
 * @returns {() => Promise<void>} deleteProfilePicture - Delete current picture
 *
 * @example
 * const { loading, updateName, updateProfilePicture, deleteProfilePicture } = useUserProfile();
 */

import { useState } from "react";
import {
  updateUserName,
  getProfilePictureUploadSignature,
  uploadToCloudinary,
  saveProfilePictureUrl,
  deleteProfilePicture as apiDeleteProfilePicture,
} from "../api/userProfileApi";
import { useAuthContext } from "../context/Auth-Context";
import toast from "react-hot-toast";

const useUserProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuthUser } = useAuthContext();

  /**
   * Update user's display name
   * ==========================
   */
  const updateName = async (name: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await updateUserName(name);

      if (response.data?.user) {
        setAuthUser(response);
        toast.success("Name updated successfully!");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update name";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Upload or update user's profile picture
   * =======================================
   * Workflow:
   * 1. Get signed upload credentials from backend
   * 2. Upload file directly to Cloudinary
   * 3. Send resulting URL to backend to save
   */
  const updateProfilePicture = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get signed upload credentials
      const signature = await getProfilePictureUploadSignature();

      // Step 2: Upload directly to Cloudinary
      const uploadedUrl = await uploadToCloudinary(file, signature, onProgress);

      // Step 3: Save URL to backend/database
      const response = await saveProfilePictureUrl(uploadedUrl);

      if (response.data?.user) {
        setAuthUser(response);
        toast.success("Profile picture updated successfully!");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to upload profile picture";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete user's profile picture
   * =============================
   */
  const deleteProfilePicture = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiDeleteProfilePicture();

      if (response.data?.user) {
        setAuthUser(response);
        toast.success("Profile picture deleted successfully!");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete profile picture";
      setError(errorMsg);

      // Only show toast if not already shown by other error handling
      if (!err || !String(err).includes("reason")) {
        toast.error(errorMsg);
      }

      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    updateName,
    updateProfilePicture,
    deleteProfilePicture,
  };
};

export default useUserProfile;
