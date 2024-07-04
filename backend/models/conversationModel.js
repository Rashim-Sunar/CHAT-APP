import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
    //contains id of participants.....
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],

    //contains id of messages.....
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'message',   //'message' here is the collection name but not model
        default: []
    }]

}, {timestamps: true});

const Conversation = mongoose.model('conversation', conversationSchema);

export default Conversation;