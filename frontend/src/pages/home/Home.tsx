import Sidebar from "../../components/sidebar/Sidebar";
import MessageContainer from "../../components/messages/MessageContainer";
import UserDetailsPanel from "../../components/details/UserDetailsPanel";
import MobileConversationBar from "../../components/mobile/MobileConversationBar";
import useConversation from "../../zustand/useConversation";

const Home = () => {
  const { selectedConversation } = useConversation();

  return (
    <div className="h-screen w-full bg-slate-100 flex flex-col md:flex-row overflow-hidden">
      <div className="md:hidden border-b border-slate-200 bg-white shrink-0">
        <MobileConversationBar />
      </div>

      <div className="hidden md:flex md:w-[280px] xl:w-[320px] border-r border-slate-200 bg-white shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 bg-white min-h-0 min-w-0">
        <MessageContainer />
      </div>

      {selectedConversation && (
        <div className="hidden xl:flex xl:w-[320px] border-l border-slate-200 bg-slate-50 shrink-0">
          <UserDetailsPanel isOpen variant="desktop" />
        </div>
      )}
    </div>
  );
};

export default Home;