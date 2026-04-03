export const getConversationKey = (firstUserId, secondUserId) => {
  if (!firstUserId || !secondUserId) return null;

  return [String(firstUserId), String(secondUserId)].sort().join("_");
};
