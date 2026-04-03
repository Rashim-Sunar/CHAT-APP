import { useEffect, useState } from "react"
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";

const useGetConversations = () => {
  const [loading, setLoading] = useState(false);
    const { conversations, setConversations } = useConversation();

  useEffect(() => {
        if (conversations.length > 0) return;

    const getConversations = async() => {
        setLoading(true);
        try {
            const res = await fetch('api/users',{
                method: "GET",
                headers: {"Content-Type" : "application/json"}
            });
            const usersData = await res.json();
            if(usersData.error){
                throw new Error(usersData.error);
            }
            
            const userDataArray = usersData?.data?.users || [];           
            // console.log(userDataArray);
            setConversations(userDataArray);
        } catch (error) {
            toast.error(error.message);
        }finally{
            setLoading(false);
        }
    }

    getConversations();
    }, [conversations.length, setConversations]);

  return {loading, conversations};
}

export default useGetConversations
