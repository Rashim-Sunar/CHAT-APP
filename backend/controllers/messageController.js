import Conversation from '../models/conversationModel.js'
import Message from '../models/messageModel.js';
import { getReceiverSocketId } from '../socket/socket.js';
import { io } from '../socket/socket.js';

export const sendMessage = async(req, res) => {
    try {
      //Get receiver id from params.id...
      const receiverId = req.params.id;
      //Sender id is the currently loggedin user id which is already attached to req body from protectRoute.js
      const senderId = req.user;
      //Destructuring message from re body...
      const {message} = req.body;
    
      //Checking if there is already communication between the users....
     let conversation = await Conversation.findOne({
        participants: {$all: [senderId, receiverId]},
     });
     
     //If there is no comversation, then establing the first conversation...
    if(!conversation){
        conversation = await Conversation.create({
            participants: [senderId, receiverId]
        });
    }

    //CReating the message
    const newMessage = await Message({
        senderId, 
        receiverId,
        message
    });
    
    //Afeter creating the message between two users push the if of that message to the messages field of Conversation model...
    if(newMessage){
        conversation.messages.push(newMessage._id);
    }
      
    // await newMessage.save();
    // await conversation.save();
    //This will be on parallel.....
    await Promise.all([newMessage.save(), conversation.save()]);

    //SOCKET FUNCTIONALITY GOES HERE....
    const receiverSocketId = getReceiverSocketId(receiverId);
    //If receiver socketId, then instead of emmitting the event to every users, send only to the receiver..
    io.to(receiverSocketId).emit("newMessage", newMessage);

    res.status(201).json({
        // status: 'success',
        newMessage
    });

    } catch (error) {
        console.log("Some error occured in message controller", error.message);
        return res.status(500).send({
            status: 'fail',
            message: 'Internal server error'
        })
    }

}


export const getMessage = async(req, res) => {
    try {
		const { id: userToChatId } = req.params;
		const senderId = req.user;

		const conversation = await Conversation.findOne({
			participants: { $all: [senderId, userToChatId] },
		}).populate("messages"); // NOT REFERENCE BUT ACTUAL MESSAGES

		if (!conversation) return res.status(200).json([]);

		const messages = conversation.messages;

		res.status(200).json(messages);
	} catch (error) {
		console.log("Error in getMessages controller: ", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
}