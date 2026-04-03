import express from "express";
import { createChat, getAllChats } from "../controllers/chat.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.post("/chat/new", isAuth, createChat);
router.get("/chat/all", isAuth, getAllChats);

export default router;