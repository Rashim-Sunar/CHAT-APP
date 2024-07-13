import path from 'path'
import express from 'express'
import dotenv from 'dotenv'


import authRouter from './routes/authRouter.js'
import messageRouter from './routes/messageRouter.js'
import userRouter from './routes/userRouter.js'
import connectToDB from './db/connectdb.js'
import cookieParser  from 'cookie-parser'
import {app, server} from './socket/socket.js';

const port = process.env.PORT || 5000;

const __dirname = path.resolve();

dotenv.config({});

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth/", authRouter);
app.use("/api/messages/", messageRouter);
app.use("/api/users/", userRouter);

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, (err)=>{
    if(err){
       return console.log("Internal server occured:", err);
        
    }
    connectToDB();
    console.log("Server listening on port: "+port);
});