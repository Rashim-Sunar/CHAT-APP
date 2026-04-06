import { useCallback, useEffect, useState } from "react";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, UserDetails } from "../types";

const useUserDetails = () => {
  const { selectedConversation, detailsRefreshVersion } = useConversation();
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedConversation?._id) {
        setDetails(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/users/${selectedConversation._id}/details`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal,
        });

        const data = (await res.json()) as UserDetails | ApiErrorResponse;

        if (!res.ok) {
          const responseError = (data as ApiErrorResponse)?.error || (data as ApiErrorResponse)?.message;
          throw new Error(responseError || "Failed to fetch user details");
        }

        const parsed = data as UserDetails;
        setDetails(parsed);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch user details";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [selectedConversation?._id]
  );

  useEffect(() => {
    const abortController = new AbortController();

    fetchDetails(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchDetails, detailsRefreshVersion]);

  const refetch = useCallback(() => {
    void fetchDetails();
  }, [fetchDetails]);

  return {
    details,
    loading,
    error,
    refetch,
  };
};

export default useUserDetails;
