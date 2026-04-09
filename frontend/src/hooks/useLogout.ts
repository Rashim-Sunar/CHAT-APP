// Handles session termination by calling the logout endpoint and clearing the
// persisted authenticated user state on success.
// Depends on the auth API, localStorage, and the shared auth context.
import { useState } from "react";
import { useAuthContext } from "../context/Auth-Context";
import toast from "react-hot-toast";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";

/**
 * End the current session and clear client-side authentication state.
 * Side effects: sends a POST request to the logout endpoint, removes the cached
 * user from localStorage, and clears the auth context.
 *
 * @returns {{ loading: boolean; logout: () => Promise<void> }} Logout action and loading state.
 */
const useLogout = () => {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuthContext();

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<{ error?: string }>("/auth/logout", {
        method: "POST",
      });
      if (data.error) {
        throw new Error(data.error);
      }

      localStorage.removeItem("chat-user");
      setAuthUser(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return { loading, logout };
};

export default useLogout;