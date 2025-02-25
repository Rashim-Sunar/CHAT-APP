import { IoSearchSharp } from "react-icons/io5";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import toast from 'react-hot-toast';
import { useState } from "react";

const SearchInput = () => {
	const [search, setSearch] = useState("");
	const {conversations} = useGetConversations();
	const {setSelectedConversation} = useConversation();

	const handleSubmit = (e) => {
		e.preventDefault();
		if(!search) return;
		if(search.length <3){
			return toast.error("Search term must be at least 3 characters long");
		}

		const conversation = conversations.find((c) => c.userName.toLowerCase().includes(search.toLowerCase()));
		if(conversation){
			setSelectedConversation(conversation);
			setSearch("");
		}else{
			toast.error("No such user found!");
		}
	}

	return (
		<form className='flex items-center gap-2' onSubmit={handleSubmit}>
			<input 
				type='text' 
				placeholder='Search…'
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className='input input-bordered rounded-full' 
		    />
			<button type='submit' className='btn btn-circle bg-sky-500 text-white'>
				<IoSearchSharp className='w-6 h-6 outline-none' />
			</button>
		</form>
	);
};
export default SearchInput;



// STARTER CODE GOES HERE.....
// import { IoSearchSharp } from "react-icons/io5";

// const SearchInput = () => {
// 	return (
// 		<form className='flex items-center gap-2'>
// 			<input type='text' placeholder='Search…' className='input input-bordered rounded-full' />
// 			<button type='submit' className='btn btn-circle bg-sky-500 text-white'>
// 				<IoSearchSharp className='w-6 h-6 outline-none' />
// 			</button>
// 		</form>
// 	);
// };
// export default SearchInput;