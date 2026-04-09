// Generate a stable conversation key regardless of which user ID comes first.
export const getConversationKey = (
  firstUserId?: string | number | null,
  secondUserId?: string | number | null
): string | null => {
  if (!firstUserId || !secondUserId) return null;

  return [String(firstUserId), String(secondUserId)].sort().join("_");
};