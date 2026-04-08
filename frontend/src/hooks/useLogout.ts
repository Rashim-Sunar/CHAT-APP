import { useState } from "react";
import { useAuthContext } from "../context/Auth-Context";
import toast from "react-hot-toast";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";

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