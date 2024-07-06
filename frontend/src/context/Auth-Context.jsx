import { createContext, useContext, useState } from "react";

export const AuthContext = createContext();

//Crating custom hook to use useContext...
export const useAuthContext =  () => {
    return useContext(AuthContext);
}

export const AuthContextProvider = ({children}) => {
    const [authUser, setAuthUser] = useState(JSON.parse(localStorage.getItem("chat-user")) || null)

    return <AuthContext.Provider value={{authUser, setAuthUser}}>
        {children}
    </AuthContext.Provider>
}