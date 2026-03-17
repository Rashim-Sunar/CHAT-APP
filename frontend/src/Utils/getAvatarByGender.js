import maleAvatar from "../assets/male.png";
import femaleAvatar from "../assets/female-avatar.jpg";

/**
 * Return a local avatar image based on the user's gender.
 *
 * @param {string} gender - The gender string from the user object.
 * @returns {string} - The imported image path.
 */
export const getAvatarByGender = (gender) => {
  if (!gender) return maleAvatar;

  const normalized = gender.toString().toLowerCase();

  if (normalized === "female" || normalized === "f") {
    return femaleAvatar;
  }

  return maleAvatar;
};
