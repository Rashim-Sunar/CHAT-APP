import mongoose from 'mongoose'

const connectdb = async() => {
    try{
        await mongoose.connect(process.env.MONGO_DB_URI);
        console.log("Connected to mongodb successfully");
    }catch(error){
        console.log(" Error connecting to database", error.messge);
    }
}

export default connectdb;