// Shared visual language across screens — mirrors the web app's indigo/slate
// palette (frontend/tailwind.config.ts) so the two clients feel like one product.
export const colors = {
  primary: "#4f46e5",
  primaryDark: "#4338ca",
  primaryLight: "#eef2ff",
  primarySoft: "#e0e7ff",

  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",

  danger: "#ef4444",
  dangerBackground: "#fef2f2",

  online: "#22c55e",

  bubbleMine: "#4f46e5",
  bubbleTheirs: "#ffffff",
  bubbleTextMine: "#ffffff",
  bubbleTextTheirs: "#0f172a",
};

export const avatarPalette = ["#4f46e5", "#0891b2", "#c026d3", "#d97706", "#16a34a", "#e11d48"];

export const avatarColorForId = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length];
};
