import Sidebar from "../../components/sidebar/Sidebar";
import MessageContainer from "../../components/messages/MessageContainer";
import UserDetailsPanel from "../../components/details/UserDetailsPanel";
import MobileConversationBar from "../../components/mobile/MobileConversationBar";

const Home = () => {
  return (
    <div className="h-screen w-full bg-slate-100 flex flex-col md:flex-row overflow-hidden">
      <div className="md:hidden border-b border-slate-200 bg-white shrink-0">
        <MobileConversationBar />
      </div>

      <div className="hidden md:flex md:w-[25%] border-r border-slate-200 bg-white">
        <Sidebar />
      </div>

      <div className="flex-1 md:w-[50%] bg-white min-h-0">
        <MessageContainer />
      </div>

      <div className="hidden lg:flex lg:w-[25%] border-l border-slate-200 bg-slate-50">
        <UserDetailsPanel />
      </div>
    </div>
  );
};

export default Home;