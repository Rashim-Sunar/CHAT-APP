import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
    //contains id of participants.....
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    //contains id of messages.....
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: []
    }]

}, {timestamps: true});

const Conversation = mongoose.model('conversation', conversationSchema);

export default Conversation;