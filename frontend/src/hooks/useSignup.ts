import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import type { ApiErrorResponse, AuthResponse, SignupCredentials } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userName, password, confirmPassword, gender }),
      });

      const data = (await res.json()) as AuthResponse & ApiErrorResponse;
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