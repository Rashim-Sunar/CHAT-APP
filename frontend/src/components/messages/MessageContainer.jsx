import React, { useEffect } from 'react'
import Messages from './Messages'
import MessageInput from './MessageInput'
import { TiMessages } from "react-icons/ti";
import useGetConversation from "../../zustand/useConversation";
import { useAuthContext } from '../../context/Auth-Context';


const MessageContainer = () => {
  const {selectedConversation, setSelectedConversation} = useGetConversation();

  useEffect(()=>{
    //Cleanup function (unmount) ->Whenever user logout selectedconvesation will be null...
    return () => setSelectedConversation(null);
  },[setSelectedConversation]);
  return (
    <div className='md:min-w-[450px] flex flex-col'>
      {!selectedConversation ? (<NoChatSelected/>) : (
          <>
          {/* Header*/}
          <div className='bg-slate-500 px-4 py-2 mb-2'>
              <span className='label-text text-gray-900'>To:</span>
              <span className='text-gray-900 font-bold'> {selectedConversation.userName}</span>
          </div>

          <Messages/>
          <MessageInput/>
      </>
      )}
    </div>
  )
}

export default MessageContainer;

const NoChatSelected = () => {
  const {authUser} = useAuthContext();
  const user = authUser?.data?.user?.userName;
	return (
		<div className='flex items-center justify-center w-full h-full'>
			<div className='px-4 text-center sm:text-lg md:text-xl text-gray-200 font-semibold flex flex-col items-center gap-2'>
				<p>Welcome 👋 {user} ❄</p>
				<p>Select a chat to start messaging</p>
				<TiMessages className='text-3xl md:text-6xl text-center' />
			</div>
		</div>
	);
};



// STARTER CODE GOES HERE.....
// const MessageContainer = () => {
//   return (
//     <div className='md:min-w-[450px] flex flex-col'>
//         <>
//             {/* Header*/}
//             <div className='bg-slate-500 px-4 py-2 mb-2'>
//                 <span className='label-text'>To: </span>
//                 <span className='text-gray-900 font-bold'>Aakash Cahurasiya</span>
//             </div>

//             <Messages/>
//             <MessageInput/>
//         </>
//     </div>
//   )
// }

// export default MessageContainer
