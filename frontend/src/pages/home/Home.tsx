import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "../../components/sidebar/Sidebar";
import MessageContainer from "../../components/messages/MessageContainer";
import UserDetailsPanel from "../../components/details/UserDetailsPanel";
import MobileConversationBar from "../../components/mobile/MobileConversationBar";
import useConversation from "../../zustand/useConversation";
import useListenMessages from "../../hooks/useListenMessages";

const Home = () => {
  const { selectedConversation } = useConversation();
  useListenMessages();

  // Desktop-only preference for the details panel; intentionally not persisted,
  // so it always starts open again on a fresh page load.
  const [desktopDetailsOpen, setDesktopDetailsOpen] = useState(true);

  return (
    <div className="h-screen w-full bg-slate-100 flex flex-col md:flex-row overflow-hidden">
      <div className="md:hidden border-b border-slate-200 bg-white shrink-0">
        <MobileConversationBar />
      </div>

      <div className="hidden md:flex md:w-[280px] xl:w-[320px] border-r border-slate-200 bg-white shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 bg-white min-h-0 min-w-0">
        <MessageContainer
          desktopDetailsOpen={desktopDetailsOpen}
          onToggleDesktopDetails={() => setDesktopDetailsOpen((open) => !open)}
        />
      </div>

      <AnimatePresence initial={false}>
        {selectedConversation && desktopDetailsOpen && (
          <motion.div
            key="desktop-details"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="hidden xl:flex bg-slate-50 shrink-0 overflow-hidden"
          >
            <div className="w-[320px] h-full shrink-0">
              <UserDetailsPanel isOpen variant="desktop" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
