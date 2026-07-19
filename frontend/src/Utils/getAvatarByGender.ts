import type { Gender } from "../types";

// Dynamically imported (rather than a static top-level import) so these default
// avatar images are code-split out of the main bundle and only fetched over the
// network when a fallback is actually needed.
export const loadGenderAvatar = async (gender?: Gender | string | null): Promise<string> => {
  const normalized = gender ? String(gender).toLowerCase() : "";

  if (normalized === "female" || normalized === "f") {
    const { default: femaleAvatar } = await import("../assets/female-avatar.jpg");
    return femaleAvatar;
  }

  const { default: maleAvatar } = await import("../assets/male.png");
  return maleAvatar;
};
