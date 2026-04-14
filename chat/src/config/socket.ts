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

export const getRecieverSocketId = (recieverId:string):string | undefined => {
    return userSocketMap[recieverId];
}

io.on("connection", (socket:Socket) => {
    console.log("A user connected", socket.id);
   
    const userId = socket.handshake.query.userId as string | undefined;

    if(userId && userId !== "undefined"){
        userSocketMap[userId] = socket.id;
        console.log(`User ID ${userId} is connected with socket ID ${socket.id}`);
    }

    io.emit("getOnlineUsers",Object.keys(userSocketMap));

    if(userId){
       socket.join(userId);
    }

    socket.on("typing",(data: {isTyping: boolean,userId:string,chatId:string}) => {
        console.log(`User ${userId} is typing in chat ${data.userId}`);
        socket.to(data.chatId).emit("userTyping",{
            userId:data.userId,
            chatId:data.chatId,
        });
    })

    socket.on("stopTyping",(data: {isTyping: boolean,userId:string,chatId:string}) => {
        console.log(`User ${userId} is stop typing in chat ${data.userId}`);
        socket.to(data.chatId).emit("userStoppedTyping",{
            userId:data.userId,
            chatId:data.chatId,
        });
    })


    socket.on("joinChat",(chatId) => {
        socket.join(chatId);
        console.log(`User ${userId} is join chat room ${chatId}`);
    })

    socket.on("leaveChat",(chatId) => {
        socket.leave(chatId);
        console.log(`User ${userId} is leave chat room ${chatId}`);
    })

    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
        if(userId){
            delete userSocketMap[userId];
            console.log(`User ${userId} remove from online user`);
            io.emit("getOnlineUsers",Object.keys(userSocketMap)); 
        }
    });

    socket.on("connect_error",(err)=>{
        console.log("socket Connection error", err.message);
    })
});


export { app, server,io }