import { IoSearchSharp } from "react-icons/io5";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import toast from "react-hot-toast";
import { useState } from "react";

const SearchInput = () => {
  const [search, setSearch] = useState("");
  const { conversations } = useGetConversations();
  const { setSelectedConversation } = useConversation();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!search) return;

    if (search.length < 3) {
      return toast.error("Search must be at least 3 characters");
    }

    const conversation = conversations.find((c) =>
      c.userName.toLowerCase().includes(search.toLowerCase())
    );

    if (conversation) {
      setSelectedConversation(conversation);
      setSearch("");
    } else {
      toast.error("User not found");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
