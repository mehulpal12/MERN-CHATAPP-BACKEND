import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import {createClient} from 'redis'
import userRoutes from "./routes/user.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import cors from "cors";

dotenv.config();
// connect to the mongodb database
connectDB();

// Frontend → Backend → RabbitMQ → Worker → Database 
// AMQP (Advanced Message Queuing Protocol)
// Backend sends task to RabbitMQ → RabbitMQ queues it → worker processes it in background → backend responds immediately so user doesn’t wait
connectRabbitMQ();


//Get messages → Redis → fast response
// Save messages to Redis for fast retrieval
    
export const redisClient = createClient(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {});


redisClient.connect().then(() => {
    console.log("Redis connected");
}).catch((err) => {
    console.log(err);
})

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())

app.use("/api/v1/user", userRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});