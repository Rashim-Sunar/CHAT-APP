// Preserves the page a signed-out user was trying to reach (e.g. an invite
// link opened while logged out) across the login round-trip.
const STORAGE_KEY = "postLoginRedirectPath";

export const savePostLoginRedirect = (path: string): void => {
  sessionStorage.setItem(STORAGE_KEY, path);
};

export const consumePostLoginRedirect = (): string | null => {
  const path = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  return path;
};
