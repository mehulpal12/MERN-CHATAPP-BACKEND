import express from "express";
import { createChat, getAllChats, getMessagesbyChat, sendMessage , getReplySuggestions} from "../controllers/chat.js";
import { isAuth } from "../middlewares/isAuth.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

router.post("/chat/new", isAuth, createChat);
router.get("/chat/all", isAuth, getAllChats);
router.post("/chat/message", isAuth, upload.single("image"), sendMessage);
router.get("/chat/message/:chatId", isAuth, getMessagesbyChat);
router.get("/chat/suggestions/:chatId", isAuth, getReplySuggestions);
export default router;