import React from 'react'
import Message from './Message.jsx'
import useGetMessages from '../../hooks/useGetMessages.js'
import MessageSkeleton from '../skeleton/MessageSkeleton.jsx';

const Messages = () => {
  const {loading, messages} = useGetMessages();
  // console.log(messages);
  return (
    // overflow-auto -->When messages are many then there seem a scroll bar...
    <div className='px-4 flex-1 overflow-auto'> 
      {!loading && messages.length > 0 && messages.map((message) => (
        <Message key={message._id} message={message}/>
      ))}

      {loading && [...Array(3)].map((_, idx) => <MessageSkeleton key={idx}/> )}
      {!loading && messages.length === 0 && (
        <p className='text-center'>Send a message to start the conversation.</p>
      )}
    </div>
  )
}

export default Messages



//STARTER CODE GOES HERE
// import React from 'react'
// import Message from './Message.jsx'

// const Messages = () => {
//   return (
//     // overflow-auto -->When messages are many then there seem a scroll bar...
//     <div className='px-4 flex-1 overflow-auto'> 
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>

//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//       <Message/>
//     </div>
//   )
// }

// export default Messages
