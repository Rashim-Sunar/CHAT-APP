import useGetConversations from "../../hooks/useGetConversations.js";
import Conversation from "./Conversation";
import { getRandomEmoji } from "../../Utils/emojis.js";

const Conversations = () => {
	const {loading, conversations} = useGetConversations();
	// console.log(conversations);
	
	return (
		<div className='py-2 flex flex-col overflow-auto'>
			{conversations.map((conversation, index) => (
				<Conversation 
					key={conversation._id}
					conversation = {conversation}
					emoji={getRandomEmoji()}
					lastIndex = {index === conversations.length - 1}
				/>
			))}
			
			{loading ? <span className="loading loading-spinner mx-auto"></span> : null}
		</div>
	);
};
export default Conversations;




//STARTER CODE GOES HERE.....
// import Conversation from "./Conversation";

// const Conversations = () => {
// 	return (
// 		<div className='py-2 flex flex-col overflow-auto'>
// 			<Conversation />
// 			<Conversation />
// 			<Conversation />
// 			<Conversation />
// 			<Conversation />
// 			<Conversation />
// 		</div>
// 	);
// };
// export default Conversations;