import { useEffect, useState } from "react"
import toast from "react-hot-toast";

const useGetConversations = () => {
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const getConversations = async() => {
        setLoading(true);
        try {
            const res = await fetch('api/users',{
                method: "GET",
                headers: {"Content-Type" : "application/json"}
            });
            const usersData = await res.json();
            if(usersData.error){
                throw new Error(data.error);
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
  }, []);

  return {loading, conversations};
}

export default useGetConversations
