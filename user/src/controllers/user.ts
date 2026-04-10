import { generateToken } from "../config/generateToken.js";
import { publishToQueue } from "../config/rabbitmq.js";
import tryCatch from "../config/tryCatch.js";
import { redisClient } from "../index.js";
import User from "../model/user.js";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";

export const loginUser = tryCatch(async (req: Request, res: Response) => {
  const { email } = req.body;
  const rateLimitKey = `otp:rateLimit:${email}`;
  const rateLimit = await redisClient.get(rateLimitKey);
  if (rateLimit) {
    return res.status(429).json({ message: "Too many requests" });
  }
  let otp = Math.floor(1000 + Math.random() * 900000).toString();
  console.log(otp);
  if(otp.length < 6){
    otp = otp.padStart(6);
  }
  const otpKey = `otp:${email}`;

  await redisClient.setEx(otpKey, 300, otp);

  await redisClient.set(rateLimitKey, "true", {
    EX: 300,
  });

  const messageSend = {
    to: email,
    subject: "OTP for login",
    text: `Your OTP is ${otp} is vaild for 5 minutes`,
  };

  await publishToQueue("send_otp", messageSend);

  res.status(200).json({ message: "OTP sent successfully", messageSend });
});

export const verifyUser = tryCatch(async (req: Request, res: Response) => {
  const { email, enteredOtp } = req.body;

  const otp: string | null = await redisClient.get(`otp:${email}`);
  if (!email || !enteredOtp) {
    return res.status(400).json({ message: "Please provide all the details" });
  }
  if (otp !== enteredOtp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }
  await redisClient.del(`otp:${email}`);

  const user = await User.findOne({ email });
  if (!user) {
    const name = email.split("@")[0];
    const newUser = await User.create({ email, name });
    const token = generateToken(newUser);
    return res
      .status(200)
      .json({ message: "User created successfully", newUser, token });
  }
  const token = generateToken(user);
  res.json({ message: "User verified successfully", token, user });
});

export const myProfile = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res
      .status(200)
      .json({ message: "User profile fetched successfully", user });
  },
);

export const updateName = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ message: "please login again" });
    }
    user.name = req.body.name;
    await user.save();
    const token = generateToken(user)
    res
      .status(200)
      .json({ message: "User name updated successfully", token, user });
  },
);

export const getAllUser = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const users = await User.find();
    res.status(200).json({ message: "All users fetched successfully", users });
  },
);

export const getAUser = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User fetched successfully", user });
  },
);

export const logoutUser = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    res.clearCookie("token");
    res.status(200).json({ message: "User logged out successfully" });
  },
);