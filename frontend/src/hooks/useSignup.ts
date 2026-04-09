// Handles account creation, persists the authenticated user, and keeps the auth
// context aligned with the backend session cookie.
// Depends on the signup API, localStorage, and toast notifications for validation
// and request failures.
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import type { ApiErrorResponse, AuthResponse, SignupCredentials } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";

/**
 * Create a new account and populate the authenticated user state on success.
 * Side effects: validates the form, sends a POST request, stores the returned
 * auth payload in localStorage, and updates the auth context.
 *
 * @returns {{ loading: boolean; signup: (credentials: SignupCredentials) => Promise<void> }} Signup action and loading state.
 */
const useSignup = () => {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuthContext();

  const signup = async ({
    email,
    userName,
    password,
    confirmPassword,
    gender,
  }: SignupCredentials): Promise<void> => {
    const success = handleInputErrors({ email, userName, password, confirmPassword, gender });
    if (!success) return;

    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse & ApiErrorResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, userName, password, confirmPassword, gender }),
      });
      if (data.error) {
        throw new Error(data.error);
      }

      localStorage.setItem("chat-user", JSON.stringify(data));
      setAuthUser(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return { loading, signup };
};

export default useSignup;

// Keep the form validation synchronous so the network request only runs for valid input.
function handleInputErrors({
  email,
  userName,
  password,
  confirmPassword,
  gender,
}: SignupCredentials): boolean {
  if (!email || !userName || !password || !confirmPassword || !gender) {
    toast.error("Enter all fields");
    return false;
  }

  if (password !== confirmPassword) {
    toast.error("Passwords do not match");
    return false;
  }

  if (password.length < 6) {
    toast.error("Password must be at least 6 characters");
    return false;
  }

  return true;
}