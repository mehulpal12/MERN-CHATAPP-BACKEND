import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import chatRoutes from "./routes/chat.js";

dotenv.config();
connectDB();
const app = express();
const port = process.env.PORT;

app.use(express.json());

app.use("/api/v1", chatRoutes)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
