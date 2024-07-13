import React from 'react'
import { useAuthContext } from '../../context/Auth-Context'
import useConversation from "../../zustand/useConversation"
import { extractTime } from "../../Utils/extractTime.js";

const Message = ({ message }) => {
	const { authUser } = useAuthContext(); //returns details of the currently loggedin user from localStorage, code in Auth-context...
  const sender = authUser?.data?.user;
	const { selectedConversation } = useConversation(); //Gets the details of the user with whom currently loggedin user is chatting..
	const fromMe = message.senderId === sender._id;
	const chatClassName = fromMe ? "chat-end" : "chat-start";
	const profilePic = fromMe ? sender.profilePic : selectedConversation?.profilePic;
	const bubbleBgColor = fromMe ? "bg-blue-500" : "";
 	// console.log(fromMe)
 	// console.log(message.senderId, sender._id)
	 const formattedTime = extractTime(message.createdAt);
	 console.log(message);
	 const shakeClass = message.shouldShake ? "shake" : "";

	return (
		<div className={`chat ${chatClassName}`}>
			<div className='chat-image avatar'>
				<div className='w-10 rounded-full'>
					<img alt='Tailwind CSS chat bubble component' src={profilePic} />
				</div>
			</div>
			<div className={`chat-bubble text-white ${bubbleBgColor} pb-3 ${shakeClass}`}>{message.message}</div>
			<div className='chat-footer opacity-50 text-xs flex gap-1 items-center'>{formattedTime}</div>
		</div>
	);
};

export default Message



//STARTER CODE GOES HERE.....
// const Message = () => {
//     return (
//       <div className='chat chat-end'>
//           <div className='chat-image avatar'>
//           <div className='w-10 rounded-full'>
//               <img 
//                   alt='Tailwind css chat bubble component'
//                   src='https://cdn0.iconfinder.com/data/icons/communication-line-10/24/account_profile_user_contact_person_avatar_placeholder-512.png'
//               />
//           </div>
//           </div>
//           <div className={`chat-bubble text-white bg-blue-500`}>Hi! What's up?</div>
//           <div className='chat-footer opacity-50 text-xs flex gap-1 items-center'>12:45</div>
//       </div>
//     )
//   }
  
//   export default Message
