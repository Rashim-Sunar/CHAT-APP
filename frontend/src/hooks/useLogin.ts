import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import type { ApiErrorResponse, AuthResponse, LoginCredentials } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";

const useLogin = () => {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuthContext();

  const login = async ({ email, password }: LoginCredentials): Promise<void> => {
    try {
      const success = handleLoginErrors(email, password);
      if (!success) return;

      setLoading(true);
      const res = await fetch("api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as AuthResponse & ApiErrorResponse;

      if (data.status === "fail") {
        throw new Error(data.message || data.error || "Login failed");
      }

      if (data.status === "success") {
        localStorage.setItem("chat-user", JSON.stringify(data));
        setAuthUser(data);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return { loading, login };
};

export default useLogin;

function handleLoginErrors(email: string, password: string): boolean {
  if (!email || !password) {
    toast.error("Fill up all the fields");
    return false;
  }

  return true;
}