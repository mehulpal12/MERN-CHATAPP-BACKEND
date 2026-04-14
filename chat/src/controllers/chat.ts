import tryCatch from "../config/tryCatch.js";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/messages.js";
import axios from "axios";
import { getRecieverSocketId, io } from "../config/socket.js";

export const createChat = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      res.status(400).json({ message: "Other user ID is required" });
      return;
    }
    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId] },
    });

    if (existingChat) {
      res.status(200).json({
        message: "chat already exist",
        chatId: existingChat._id,
      });
      return;
    }

    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({
      message: "chat created successfully",
      chatId: newChat._id,
    });
  },
);

export const getAllChats = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(400).json({
        message: "user id is required",
      });
      return;
    }
    const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

    const chatWithUserData = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.users.find((id) => id.toString() !== userId.toString());
        const url = process.env.USER_SERVICE_URL as string;
            if(!url){
                console.log("url is not found")
            }else{
                console.log(url)
            }
        const unseenCount = await Messages.countDocuments({
          chatId: chat._id,
          sender: { $ne: userId },
          seen: false,
        });
        try {
          const { data } = await axios.get(
            `${process.env.USER_SERVICE_URL}/api/v1/user/${otherUserId}`,
            { headers: { Authorization: req.headers.authorization as string } }
          );

          return {
            user: data.user,
            chat: {
              ...chat.toObject(),
              latestMessage: chat.latestMessage || null,
              unseenCount,
            },
          };
        } catch (err) {
          console.log(err);
          return {
            user: { _id: otherUserId, name: "unknown user" },
            chat: {
              ...chat.toObject(),
              latestMessage: chat.latestMessage || null,
              unseenCount,
            },
          };
        }
      }),
    );
    res.status(200).json({
      message: "chats fetched successfully 2",
      chats: chatWithUserData,
    });
  },
);

export const sendMessage = tryCatch(async(req:AuthenticatedRequest,res:Response)=>{
  const senderId = req.user?._id;
  if (!senderId) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  const {chatId,text} = req.body;
  const imageFile = req.file;
  if(!chatId || !text){
    res.status(400).json({
      message:"chat and text id is required",
    })
    return;
  }
  const chat = await Chat.findById(chatId);
  if(!chat){
    res.status(404).json({
      message:"chat not found",
    })
    return;
  }

  const isUserInChat = chat.users.some((id)=>id.toString() === senderId.toString());
  if(!isUserInChat){
    res.status(403).json({
      message:"user is not part of this chat",
    })
    return;
  }

  const otherUserId = chat.users.find((id)=>id.toString() !== senderId.toString());
   if (!otherUserId) {
    res.status(401).json({ message: "other user is not found" });
    return;
  }

  // socket.io setup

  const recieverSocketId = getRecieverSocketId(otherUserId.toString());

  let isReceiverInChatRoom = false;


  if(recieverSocketId){
    const receiverSocket = io.sockets.sockets.get(recieverSocketId);
    if(receiverSocket && receiverSocket.rooms.has(chatId)){
      isReceiverInChatRoom = true;
    }
  }
  
  const messagePayload: any = {
    chatId,
    sender: senderId,
    seen: isReceiverInChatRoom,
    seenAt: isReceiverInChatRoom ? new Date() : undefined,
    text,
  };

  if (imageFile) {
    messagePayload.image = {
      url: (imageFile as any).path,
      public_id: (imageFile as any).filename,
    };
    messagePayload.messageType = "image";
    messagePayload.text = text || "";
  }else{
    messagePayload.messageType = "text";
    messagePayload.text = text;
  }

  const messageData = await Messages.create(messagePayload);

  const savedMessage = await messageData.save();

  const latestMessageText = imageFile ? "image" : text;

  await Chat.findByIdAndUpdate(chatId,{
    latestMessage:{
      text:latestMessageText,
      sender:senderId,
    },
    updatedAt:new Date(),
  }, {new:true})

  // emit to socket

  io.to(chatId).emit("newMessage",savedMessage);

  if(recieverSocketId){
    io.to(recieverSocketId as string).emit("newMessage",savedMessage);
  }

  const senderSocketId = getRecieverSocketId(senderId.toString());
  if(senderSocketId){
    io.to(senderSocketId as string).emit("newMessage",savedMessage);
  }

  if(isReceiverInChatRoom && senderSocketId){
      io.to(senderSocketId as string).emit("messagesSeen",{
        chatId:chatId,
        seenBy:otherUserId,
        messageIds:[savedMessage._id],
        
      });
  }

  res.status(201).json({
    message: "message sent successfully",
    newMessage: savedMessage,
  });
})


export const getMessagesbyChat = tryCatch(async(req:AuthenticatedRequest,res:Response)=>{
  const userId = req.user?._id;
  if(!userId){
    res.status(401).json({
      message:"user is not authenticated",
    })
    return;
  }

  const {chatId} = req.params;
  if(!chatId){
    res.status(400).json({
      message:"chat id is required",
    })
    return;
  }

  const chat = await Chat.findById(chatId);
  if(!chat){
    res.status(404).json({
      message:"chat not found",
    })
    return;
  }

  const isUserInChat = chat.users.some((id)=>id.toString() === userId.toString());
  if(!isUserInChat){
    res.status(403).json({
      message:"user is not part of this chat",
    })
    return;
  }

  const unreadMessages = await Messages.find({
    chatId,
    sender: { $ne: userId },
    seen: false,
  });

  if (unreadMessages.length > 0) {
    await Messages.updateMany(
      { _id: { $in: unreadMessages.map(m => m._id) } },
      {
        $set: {
          seen: true,
          seenAt: new Date(),
        },
      }
    );
  }

  const messages = await Messages.find({chatId}).sort({createdAt:1});
  const otherUserId = chat.users.find((id)=>id.toString() !== userId.toString());

  if (!otherUserId) {
    res.status(400).json({ message: "other user not found" });
    return;
  }

  try{
    const {data} = await axios.get(`${process.env.USER_SERVICE_URL}/api/v1/user/${otherUserId.toString()}`, {
      headers: { Authorization: req.headers.authorization as string }
    });

    // socket work
    if(unreadMessages.length > 0){
      const otherUserSocketId = getRecieverSocketId(otherUserId.toString())
      if(otherUserSocketId){
        io.to(otherUserSocketId as string).emit("messagesSeen", {
          chatId:chatId,
          seenBy: userId,
          messageIds: unreadMessages.map((msg) => msg._id)
        })
      }
    }


    res.status(200).json({
      message:"messages fetched successfully",
      messages,
      otherUserId,
      user:data.user,
    })
  }catch(err){
    console.log(err);
    res.status(500).json({
      message:"internal server error",
      user:{
        _id: otherUserId,
        name:"unknown user",
      }
    })
  }
})