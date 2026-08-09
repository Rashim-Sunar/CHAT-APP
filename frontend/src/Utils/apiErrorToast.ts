import toast from "react-hot-toast";
import { ApiFetchError } from "./apiFetch";
import { getErrorMessage } from "./getErrorMessage";

// Shared error toast for data-fetching hooks: skips 401 (handled globally),
// and dedupes onto one toast id so simultaneous fetches don't stack duplicates.
export const showFetchErrorToast = (error: unknown, toastId: string): void => {
  if (error instanceof ApiFetchError) {
    if (error.status === 401) return;

    if (error.status === 429) {
      toast.error("You're refreshing a bit too fast — please wait a moment and try again.", {
        id: toastId,
      });
      return;
    }
  }

  toast.error(getErrorMessage(error), { id: toastId });
};
