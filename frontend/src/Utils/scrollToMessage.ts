// Scrolls a message bubble into view and briefly highlights it, keyed by the
// data-message-id attribute every bubble renders. Shared by reply-preview
// jump-to (Message.tsx) and pinned-message jump-to (SharedContentSection,
// PinnedMessageBanner) — pure DOM lookup, not tied to which message list
// state the caller has loaded.
export const scrollToMessage = (messageId: string): void => {
  const targetEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!targetEl) return;

  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

  targetEl.classList.add("message-highlight");
  const cleanup = () => {
    targetEl.classList.remove("message-highlight");
    targetEl.removeEventListener("animationend", cleanup);
  };
  targetEl.addEventListener("animationend", cleanup);
};
