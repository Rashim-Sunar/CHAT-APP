import mongoose from 'mongoose'

const connectdb = async() => {
    try{
        console.log("Connecting to Mongodb...", process.env.MONGO_DB_URI);
        await mongoose.connect(process.env.MONGO_DB_URI);
        console.log("Connected to mongodb successfully");
    }catch(error){
        console.log(" Error connecting to database", error.message);
    }
}

export default connectdb;