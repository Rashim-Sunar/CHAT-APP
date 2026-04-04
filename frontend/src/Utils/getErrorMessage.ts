export const getErrorMessage = (error: unknown, fallback = "Something went wrong"): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
};