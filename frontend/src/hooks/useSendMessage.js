import { useState } from "react"
import useConversation from "../zustand/useConversation"
import toast from 'react-hot-toast'
import { useAuthContext } from "../context/Auth-Context"
import { getConversationKey } from "../Utils/conversationKey"

const useSendMessage = () => {
    const [loading, setLoading] = useState(false);
    const { authUser } = useAuthContext();
    const {
        selectedConversation,
        appendMessageToConversation,
        upsertConversationFromMessage,
    } = useConversation();

    const sendMessage = async(message) => {
        if (!selectedConversation?._id) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/messages/send/${selectedConversation._id}`, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({message})
            });   

            const data = await res.json();
            if(data.error) throw new Error(data.error);

            const currentUserId = authUser?.data?.user?._id;
            const outgoingMessage = data?.newMessage;

            const conversationKey =
                outgoingMessage?.conversationId ||
                getConversationKey(
                    outgoingMessage?.senderId,
                    outgoingMessage?.receiverId
                );

            if (conversationKey && outgoingMessage) {
                appendMessageToConversation(conversationKey, outgoingMessage);

                if (currentUserId) {
                    upsertConversationFromMessage(outgoingMessage, currentUserId);
                }
            }
            
        } catch (error) {
            toast.error(error.message);
        }finally{
            setLoading(false);
        }
    }

    return {loading, sendMessage};
}

export default useSendMessage
