import express from "express";
import {loginUser, verifyUser, myProfile, getAUser,getAllUser, updateName} from "../controllers/user.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.send("Hello World!");
});

router.post("/login", loginUser);
router.post("/verify", verifyUser);
router.get("/me", isAuth, myProfile);
router.get("/all", isAuth, getAllUser);
router.get("/:id", isAuth, getAUser);
router.post("/update", isAuth, updateName);

export default router;
