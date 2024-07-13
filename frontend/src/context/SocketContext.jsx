import { createContext, useEffect, useState } from "react";
import { useAuthContext } from "./Auth-Context";
import {io} from 'socket.io-client'

export const SocketContext = createContext();

export const SocketContextProvider = ({children}) => {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const {authUser} = useAuthContext(); //Currently loggedin user...

    useEffect(() => {
        if(authUser){
            const socket = io("http://localhost:5000"); //Server url....
            setSocket(socket);

            //CLeanup code --> unmount the component..
            return () => socket.close();
        }else{
            if(socket){
                socket.close();
                setSocket(null);
            }
        }

    },[]);
    return (
        <SocketContext.Provider value={{socket, onlineUsers}}>
            {children}
        </SocketContext.Provider>
    )
}