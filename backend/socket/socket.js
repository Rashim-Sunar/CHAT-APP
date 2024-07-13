import {Server} from 'socket.io'
import http from 'http';
import express from 'express';

const app = express();

const server = http.createServer(app);
//socket may give some cors error so,fixing it
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000"], //frontend url...
        methods: ["GET", "POST"] //run socket for get and post methods only...
    }
});

//function to get the receiver socketId from the message reciver.....
export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId]; 
}

const userSocketMap = {}; //{userId: socketId}

io.on('connection', (socket) => {
    console.log("A new user connected with id: ", socket.id);

    const userId = socket.handshake.query.userId; //Getting userId from frontend SocketContext.jsx
    if(userId != 'undefined') userSocketMap[userId] = socket.id;

    //io.emit() is used to send events to all connected clients...
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); //WHenever a new user connected to socket send all connected users to him...


    //socket.on() is used to listen the events. can be used in both client and server side..
    socket.on('disconnect', () => {
        console.log("User disconnected: "+socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    })
})

export {app, io, server}