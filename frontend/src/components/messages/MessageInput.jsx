import React, { useState } from 'react'
import { BsFillSendFill } from "react-icons/bs"
import useSendMessage from '../../hooks/useSendMessage'

const MessageInput = () => {
  const {loading, sendMessage} = useSendMessage();

  const [message, setMessage] = useState("");

  const handleSubmit = async(event) => {
    event.preventDefault();
    if(!message) return;
    await sendMessage(message);
    setMessage(" ");
  }

  return (
    <form className='px-4 my-3' onSubmit={handleSubmit}>
        <div className='w-full relative'>
            <input 
                type='text' 
                className='w-full text-sm block border rounded-lg p-2.5 bg-gray-600 text-white'
                placeholder='Send a message'
                onChange={(event) => setMessage(event.target.value)}
                value={message}
            />
            <button type='submit' className='absolute text-white inset-y-0 end-0 flex items-center pe-3 justify-center'>
                {!loading ? (<BsFillSendFill/>) : <span className='loading loading-spinner'></span> }
            </button>
        </div>
    </form>
  )
}

export default MessageInput




//INITIAL CODE GOES HERE.....
// import { BsFillSendFill } from "react-icons/bs"

// const MessageInput = () => {
//   return (
//     <form className='px-4 my-3'>
//         <div className='w-full relative'>
//             <input 
//                 type='text' 
//                 className='w-full text-sm block border rounded-lg p-2.5 bg-gray-600 text-white'
//                 placeholder='Send a message'
//             />
//             <button type='submit' className='absolute text-white inset-y-0 end-0 flex items-center pe-3 justify-center'>
//                 <BsFillSendFill/>
//             </button>
//         </div>
//     </form>
//   )
// }

// export default MessageInput



