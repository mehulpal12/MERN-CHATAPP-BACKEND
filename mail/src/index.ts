import express from "express";
import dotenv from "dotenv";
import { startSentOtpConsumer } from "./consumer.js";

dotenv.config();

const app = express();
startSentOtpConsumer()

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});