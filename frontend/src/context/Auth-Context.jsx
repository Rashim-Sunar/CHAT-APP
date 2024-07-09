import { createContext, useContext, useState } from "react";

export const AuthContext = createContext();

//Crating custom hook to use useContext...
export const useAuthContext =  () => {
    return useContext(AuthContext);
}

export const AuthContextProvider = ({children}) => {
    const [authUser, setAuthUser] = useState(JSON.parse(localStorage.getItem("chat-user")) || null); //Whenever user type url hcecking if the user is already loggedin, if so taking user info from localstorage and authorize him.
    //If no user data is stored in localstorage set the authorization to false initially...

    return <AuthContext.Provider value={{authUser, setAuthUser}}>
        {children}
    </AuthContext.Provider>
}