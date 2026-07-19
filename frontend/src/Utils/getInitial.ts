// Ultimate avatar fallback: a single uppercase letter, so something always
// renders even when no image (real or default) is available.
export const getInitial = (name?: string | null): string => {
  const trimmed = (name || "").trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
};
