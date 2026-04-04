import maleAvatar from "../assets/male.png";
import femaleAvatar from "../assets/female-avatar.jpg";
import type { Gender } from "../types";

export const getAvatarByGender = (gender?: Gender | string | null): string => {
  if (!gender) return maleAvatar;

  const normalized = String(gender).toLowerCase();

  if (normalized === "female" || normalized === "f") {
    return femaleAvatar;
  }

  return maleAvatar;
};