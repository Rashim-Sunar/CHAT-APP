// Fetches the plain list of all other users, used by pickers (new chat,
// create group, add members) rather than the sidebar (which is driven by
// useGetConversations now that conversations are real documents).
import { useEffect, useState } from "react";
import { useAuthContext } from "../context/Auth-Context";
import type { User } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import { showFetchErrorToast } from "../Utils/apiErrorToast";

interface UsersResponse {
  error?: string;
  status?: string;
  data?: {
    users?: User[];
  };
}

const useGetAllUsers = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  useEffect(() => {
    if (!currentUserId) return;

    const getUsers = async () => {
      setLoading(true);
      try {
        const response = await apiFetch<UsersResponse>("/users", { method: "GET" });
        if (response.error) {
          throw new Error(response.error);
        }

        setUsers(response?.data?.users || []);
      } catch (error: unknown) {
        showFetchErrorToast(error, "get-all-users-error");
      } finally {
        setLoading(false);
      }
    };

    getUsers();
  }, [currentUserId]);

  return { loading, users };
};

export default useGetAllUsers;
