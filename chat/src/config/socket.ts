import { Server,Socket } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const userSocketMap:Record<string,string> = {}

io.on("connection", (socket:Socket) => {
    console.log("A user connected", socket.id);
   
    const userId = socket.handshake.query.userId as string | undefined;

    if(userId && userId !== "undefined"){
        userSocketMap[userId] = socket.id;
        console.log(`User ID ${userId} is connected with socket ID ${socket.id}`);
    }

    io.emit("getOnlineUsers",Object.keys(userSocketMap));

    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
    });

    socket.on("connect_error",(err)=>{
        console.log("socket Connection error", err.message);
    })
});


export { app, server,io }