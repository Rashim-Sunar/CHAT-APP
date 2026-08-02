import type { Conversation, ConversationParticipant } from "../types";

// For a direct conversation, returns the participant who isn't the current
// user — used to resolve gender for the Avatar fallback image (displayName/
// displayAvatar are already server-computed, but gender isn't surfaced at
// the top level since it's meaningless for groups).
export const getOtherParticipant = (
  conversation: Conversation | null | undefined,
  currentUserId?: string | null
): ConversationParticipant | undefined => {
  if (!conversation || conversation.type !== "direct") return undefined;

  return conversation.participants.find((participant) => participant._id !== currentUserId);
};
