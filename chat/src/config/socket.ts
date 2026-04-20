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

export const getReciverSocketId = (reciverId: string) : string | undefined => {
    return userSocketMap[reciverId];
}

io.on("connection", (socket:Socket) => {
    console.log("A user connected", socket.id);
   
    const userId = socket.handshake.query.userId as string | undefined;

    if(userId && userId !== "undefined"){
        userSocketMap[userId] = socket.id;
        console.log(`User ID ${userId} is connected with socket ID ${socket.id}`);
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    if (userId) {
        socket.join(userId);
    }

    socket.on("typing", (data) => {
        // console.log(`user ${data.userId} is typing in chat ${data.chatId}`);
        socket.to(data.chatId).emit("userTyping", {
            chatId: data.chatId,
            userId: data.userId
        });
    });

    socket.on("stopTyping", (data) => {
        // console.log(`user ${data.userId} stopped typing`);
        socket.to(data.chatId).emit("stopTyping", {
            chatId: data.chatId,
            userId: data.userId
        })
    });

    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
        if (userId) {
            delete userSocketMap[userId];
            console.log(`user ${userId} removed from online users`);
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        }
    });

    socket.on("joinChat", (chatId) => {
        socket.join(chatId);
        console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    socket.on("leaveChat", (chatId) => {
        socket.leave(chatId);
        console.log(`User ${socket.id} left chat ${chatId}`);
    });

    socket.on("connect_error", (err) => {
        console.log("socket Connection error", err.message);
    });
});


export { app, server,io }