import Conversations from "./Conversations";
import SearchInput from "./SearchInput";
import LogoutButton from "./LogoutButton";

const Sidebar = () => {
  return (
    <div className="flex flex-col w-full h-full bg-white">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800">
          Chats
        </h2>
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b border-slate-100">
        <SearchInput />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <Conversations />
      </div>

      {/* Logout */}
      <div className="px-6 py-4 border-t border-slate-200">
        <LogoutButton />
      </div>

    </div>
  );
};

export default Sidebar;
