import express from 'express'
import dotenv from 'dotenv'


import authRouter from './routes/authRouter.js'
import connectToDB from './db/connectdb.js'

const app = express();
const port = process.env.PORT || 5000;
dotenv.config({});

app.use(express.json());

app.use("/api/auth/", authRouter);

app.listen(port, (err)=>{
    if(err){
       return console.log("Internal server occured:", err);
        
    }
    connectToDB();
    console.log("Server listening on port: "+port);
});