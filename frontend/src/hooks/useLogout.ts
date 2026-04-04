import { useState } from "react";
import { useAuthContext } from "../context/Auth-Context";
import toast from "react-hot-toast";
import { getErrorMessage } from "../Utils/getErrorMessage";

const useLogout = () => {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuthContext();

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json()) as { error?: string };
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