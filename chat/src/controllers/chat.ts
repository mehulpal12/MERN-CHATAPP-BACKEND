import tryCatch from "../config/tryCatch.js";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/messages.js";
import axios from "axios";
import { generateSuggestions } from "../config/ai.js"
import { io, getReciverSocketId } from "../config/socket.js";

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
        if (!url) {
          console.log("url is not found")
        } else {
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

export const sendMessage = tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user?._id;
  if (!senderId) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  const { chatId, text } = req.body;
  const imageFile = req.file;
  if (!chatId) {
    res.status(400).json({
      message: "chat id is required",
    })
    return;
  }
  if (!text && !imageFile) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }
  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404).json({
      message: "chat not found",
    })
    return;
  }

  const isUserInChat = chat.users.some((id) => id.toString() === senderId.toString());
  if (!isUserInChat) {
    res.status(403).json({
      message: "user is not part of this chat",
    })
    return;
  }

  const otherUserId = chat.users.find((id) => id.toString() !== senderId.toString());
  if (!otherUserId) {
    res.status(401).json({ message: "other user is not found" });
    return;
  }

  // socket.io setup

  const recieverSocketId = getReciverSocketId(otherUserId.toString());
  let isRecieverInChatRoom = false

  if (recieverSocketId) {
    const recieverSocket = io.sockets.sockets.get(recieverSocketId)
    if (recieverSocket && recieverSocket.rooms.has(chatId)) {
      isRecieverInChatRoom = true
    }
  }


  const messagePayload: any = {
    chatId,
    sender: senderId,
    seen: isRecieverInChatRoom,
    seenAt: isRecieverInChatRoom ? new Date() : undefined,
    text,
  };

  if (imageFile) {
    messagePayload.image = {
      url: (imageFile as any).path,
      public_id: (imageFile as any).filename,
    };

    let messageType = "image";
    if (text) {
      messageType = "mixed";
    }

    messagePayload.messageType = messageType;
    messagePayload.text = text || "";
  } else {
    messagePayload.messageType = "text";
    messagePayload.text = text;
  }

  // const messageData = await Messages.create(messagePayload);

  const savedMessage = await Messages.create(messagePayload);

  const latestMessageText = imageFile ? "image" : text;

  await Chat.findByIdAndUpdate(chatId, {
    latestMessage: {
      text: latestMessageText,
      sender: senderId,
    },
    updatedAt: new Date(),
  }, { returnDocument: 'after' })

  // emit to socket

  io.to(chatId).emit("newMessage", savedMessage)

  if (recieverSocketId) {
    io.to(recieverSocketId).emit("newMessage", savedMessage)
  }

  const senderSocketId = getReciverSocketId(senderId.toString())

  if (senderSocketId) {
    io.to(senderSocketId).emit("newMessage", savedMessage)
  }

  if (isRecieverInChatRoom && senderSocketId) {
    io.to(senderSocketId).emit("messageSeen", {
      chatId: chatId,
      seenBy: otherUserId,
      messageIds: [savedMessage._id]
    })
  }


  res.status(201).json({
    message: "message sent successfully",
    newMessage: savedMessage,
  });
})


export const getMessagesbyChat = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "user is not authenticated",
      });
    }

    const { chatId } = req.params;
    const { cursor, limit = 20 } = req.query;

    if (!chatId) {
      return res.status(400).json({
        message: "chat id is required",
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "chat not found",
      });
    }

    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isUserInChat) {
      return res.status(403).json({
        message: "user is not part of this chat",
      });
    }

    // 🔹 Build query with cursor pagination
    const query: any = { chatId };

    if (cursor) {
      const parsedCursor = new Date(cursor as string);
      if (!isNaN(parsedCursor.getTime())) {
        query.createdAt = { $lt: parsedCursor };
      }
    }

    // 🔹 Fetch messages (latest first)

    const messages = await Messages.find(query)
      .sort({ createdAt: -1 })

    if (messages.length === 0) {
      return res.status(200).json({
        message: "no messages",
        messages: [],
        nextCursor: null,
      });
    }

    // 🔹 Reverse for frontend (old → new)
    const formattedMessages = messages.reverse();

    const unseenMessageIds = messages
      .filter(
        (msg) =>
          msg.sender.toString() !== userId.toString() && !msg.seen
      )
      .map((msg) => msg._id);

    if (unseenMessageIds.length > 0) {
      await Messages.updateMany(
        { _id: { $in: unseenMessageIds } },
        {
          $set: {
            seen: true,
            seenAt: new Date(),
          },
        }
      );
    }

    const otherUserId = chat.users.find(
      (id) => id.toString() !== userId.toString()
    );

    // 🔹 Notify other user (seen update)
    if (otherUserId && unseenMessageIds.length > 0) {
      const otherUserSocketId = getReciverSocketId(
        otherUserId.toString()
      );

      if (otherUserSocketId) {
        io.to(otherUserSocketId).emit("messagesSeen", {
          chatId,
          seenBy: userId,
          messageIds: unseenMessageIds,
        });
      }
    }

    try {
      const { data } = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/v1/user/${otherUserId}`,
        {
          headers: {
            Authorization: req.headers.authorization as string,
          },
        }
      );

      return res.status(200).json({
        message: "messages fetched successfully",
        messages: formattedMessages,
        otherUserId,
        user: data.user,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        message: "internal server error",
        user: {
          _id: otherUserId,
          name: "unknown user",
        },
      });
    }
  }
);


export const getReplySuggestions = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // ensure user belongs to chat
    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isUserInChat) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 🔥 fetch last messages
    const messages = await Messages.find({
      chatId: chatId as string | string[] // Casting tells TS "I know what I'm doing"
    })
      .sort({ createdAt: -1 })
      .limit(5);

    const context = messages
      .map((m) => m.text)
      .filter((text): text is string => Boolean(text))
      .reverse(); // oldest → newest

    // 🔥 generate suggestions
    const suggestions = await generateSuggestions(context) as string[];

    return res.status(200).json({ suggestions });
  }
);


