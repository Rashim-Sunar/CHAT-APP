import { IoSearchSharp } from "react-icons/io5";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import toast from "react-hot-toast";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useAuthContext } from "../../context/Auth-Context";

const SearchInput = () => {
  const [search, setSearch] = useState("");
  const { conversations } = useGetConversations();
  const { setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!search) return;

    if (search.length < 3) {
      toast.error("Search must be at least 3 characters");
      return;
    }

    const conversation = conversations.find((candidate) =>
      candidate.userName.toLowerCase().includes(search.toLowerCase())
    );

    if (conversation) {
      setSelectedConversation(conversation, currentUserId);
      setSearch("");
    } else {
      toast.error("User not found");
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={handleChange}
        className="w-full h-10 pl-10 pr-4 rounded-full 
                   border border-slate-300 
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition duration-200 text-sm"
      />

      <IoSearchSharp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
    </form>
  );
};

export default SearchInput;