// ----------------------------------------
// @file   Utils/sharedContent.ts
// @desc   Extracts shared media/links/documents from a message set for the
//         conversation details panel. Conversation-scoped (by
//         conversationId), so it works identically for direct and group
//         conversations — unlike the legacy user-pair query it replaces.
// ----------------------------------------

export const MAX_ITEMS_PER_SECTION = 120;
export const MAX_LINK_SOURCE_MESSAGES = 300;
export const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

export type SharedContentResponse = {
  media: Array<{ url: string; type: 'image' | 'video'; createdAt: Date }>;
  links: Array<{ url: string; title: string; createdAt: Date }>;
  documents: Array<{ name: string; url: string; size?: number; createdAt: Date }>;
};

// Visibility guard shared across details builders — messages deleted for
// everyone are hidden, and per-user deletions are filtered against the
// current viewer id.
export const isVisibleToUser = (
  message: { deletedForEveryone?: boolean; deletedFor?: unknown[] },
  userId: string
): boolean => {
  if (message.deletedForEveryone) return false;

  const deletedFor = Array.isArray(message.deletedFor) ? message.deletedFor.map((value) => String(value)) : [];
  return !deletedFor.includes(String(userId));
};

// Strip trailing punctuation often included by natural typing so links remain valid.
export const normalizeUrl = (rawUrl: string): string => {
  return rawUrl.trim().replace(/[),.;!?]+$/g, '');
};

// Build a compact, human-readable link title from the URL.
// Falls back to raw input when parsing fails so we never drop data.
export const buildLinkTitle = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;

    if (!path) return host;

    const readablePath = decodeURIComponent(path)
      .replace(/[-_]/g, ' ')
      .replace(/\/+$/, '');

    return `${host}${readablePath}`;
  } catch {
    return rawUrl;
  }
};
