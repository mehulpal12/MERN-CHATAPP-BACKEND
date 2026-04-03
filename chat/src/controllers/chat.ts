import tryCatch from "../config/tryCatch.js";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/messages.js";
import axios from "axios";

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
        const otherUserId = chat.users.find((id) => id !== userId);
        const unseenCount = await Messages.countDocuments({
          chatId: chat._id,
          sender: { $ne: userId },
          seen: false,
        });
        try {
          const { data } = await axios.get(
            `${process.env.USER_SERVICE_URL}/api/v1/${otherUserId}`,
          );

          return {
            user: data,
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
      message: "chats fetched successfully",
      chats: chatWithUserData,
    });
  },
);

// export const sendMessage = 2:49:35
