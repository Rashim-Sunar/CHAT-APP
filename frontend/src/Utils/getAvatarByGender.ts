import maleAvatar from "../assets/male.png";
import femaleAvatar from "../assets/female-avatar.jpg";
import type { Gender } from "../types";

// Use a predictable avatar fallback so missing or partial profile data still renders cleanly.
export const getAvatarByGender = (gender?: Gender | string | null): string => {
  if (!gender) return maleAvatar;

  // Accept the typed union as well as older string values coming from persisted data.
  const normalized = String(gender).toLowerCase();

  if (normalized === "female" || normalized === "f") {
    return femaleAvatar;
  }

  return maleAvatar;
};