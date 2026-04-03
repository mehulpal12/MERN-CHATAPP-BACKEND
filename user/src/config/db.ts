import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    let url = process.env.MONGODB_URI;
    if(!url){
        throw new Error("Please provide MONGODB_URI in the .env file");
    }
    try {
        await mongoose.connect(url,{
            dbName:"Chat-app-microservices"
        });
        console.log("MongoDB connected");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
};

export default connectDB;