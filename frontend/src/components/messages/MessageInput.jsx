import { useState } from "react";
import { BsFillSendFill } from "react-icons/bs";
import useSendMessage from "../../hooks/useSendMessage";

const MessageInput = () => {
  const { loading, sendMessage } = useSendMessage();
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 p-4"
    >
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 h-12 px-4 rounded-full border border-slate-300 
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition duration-200"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        type="submit"
        className="w-12 h-12 rounded-full bg-indigo-600 text-white 
                   flex items-center justify-center
                   hover:bg-indigo-700 transition duration-200"
      >
        <BsFillSendFill />
      </button>
    </form>
  );
};

export default MessageInput;
