import { useState } from "react"
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";

const useLogin = () => {
    const [loading, setLoading] = useState(false);
    const {setAuthUser} = useAuthContext();

    const login = async({email, password}) => {
        try {
           const success = handleLoginErrors(email, password); 
           if(!success) return;
            setLoading(true);
           const res = await fetch("api/auth/login", {
            method: "POST",
            headers: {"Content-Type" : "application/json"},
            body: JSON.stringify({email, password})
           });

           const data = await res.json();
           if(data.error){
            throw new Error(data.error);
           }

           localStorage.setItem('chat-user', JSON.stringify(data));
           setAuthUser(data);   
        } catch (error) {
            toast.error(error.message);
        }finally{
            setLoading(false);
        }
    }
    return {loading, login};
}

export default useLogin;

function handleLoginErrors(email, password){
    if(!email || !password){
        toast.error("Fill up all the fields");
        return false;
    }

    return true;
}
