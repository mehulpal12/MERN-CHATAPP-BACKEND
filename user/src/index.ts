import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import {createClient} from 'redis'
import userRoutes from "./routes/user.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import cors from "cors";

dotenv.config();

connectDB();

connectRabbitMQ()

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