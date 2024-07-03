import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'USer'
    },

    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    message: {
        type: String,
        required: true
    }
}, {timestamps: true});

const Message = mongoose.model('message', messageSchema);

export default Message;