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

io.on('connection', (socket) => {
    console.log("A new user connected with id: ", socket.id);

    //socket.on() is used to listen the events. can be used in both client and server side..
    socket.on('disconnect', () => {
        console.log("User disconnected: "+socket.id);
    })
})

export {app, io, server}