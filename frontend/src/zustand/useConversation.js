import {create} from 'zustand'
//zustand is a state management system in react jusk like redux but for small projects..

const useGetConversation = create((set)=> ({
    selectedConversation: null,
    setSelectedConversation: (selectedConversation) => set({selectedConversation}),
    messages: [],
    setMessages : (messages) => set({messages}),

}));

export default useGetConversation;
