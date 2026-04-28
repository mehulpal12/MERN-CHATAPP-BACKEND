import { generateToken } from "../config/generateToken.js";
import { publishToQueue } from "../config/rabbitmq.js";
import tryCatch from "../config/tryCatch.js";
import { redisClient } from "../index.js";
import User from "../model/user.js";
import crypto from "crypto";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";

/**
 * Generate secure OTP
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};



/**
 * LOGIN (Send OTP)
 */
export const loginUser = tryCatch(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const rateLimitKey = `otp:rateLimit:${email}`;
  const otpKey = `otp:${email}`;

  // Rate limiting
  const isRateLimited = await redisClient.get(rateLimitKey);
  if (isRateLimited) {
    return res.status(429).json({
      message: "Too many requests. Please try again after some time.",
    });
  }

  // Generate OTP
  const otp = generateOtp();

  // Store hashed OTP (1 minutes)
  await redisClient.setEx(otpKey, 60, otp);

  // Rate limit (1 minutes)
  await redisClient.set(rateLimitKey, "true", { EX: 60 });

  // Send email via RabbitMQ
  await publishToQueue("send_otp", {
    to: email,
    subject: "OTP for Login",
    text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
  });
  console.log(`${email} otp is ${otp}`)

  return res.status(200).json({
    message: `OTP sent successfully ${otp}`,
  });
});

/**
 * VERIFY OTP
 */
export const verifyUser = tryCatch(async (req: Request, res: Response) => {
  const { email, enteredOtp } = req.body;

  if (!email || !enteredOtp) {
    return res
      .status(400)
      .json({ message: "Email and OTP are required" });
  }

  const otpKey = `otp:${email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp) {
    return res.status(400).json({
      message: "OTP expired or not found",
    });
  }


  if (storedOtp !== enteredOtp) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }

  // OTP is valid → delete it
  await redisClient.del(otpKey);

  // Check user
  let user = await User.findOne({ email });

  if (!user) {
    const name = email.split("@")[0];
    user = await User.create({ email, name });
  }

  const token = generateToken(user);

  return res.status(200).json({
    message: "User verified successfully",
    token,
    user,
  });
});

/**
 * GET PROFILE
 */
export const myProfile = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({
      message: "Profile fetched successfully",
      user: req.user,
    });
  }
);

/**
 * UPDATE NAME
 */
export const updateName = tryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name;
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      message: "Name updated successfully",
      user,
      token,
    });
  }
);

/**
 * GET ALL USERS
 */
export const getAllUser = tryCatch(
  async (_req: Request, res: Response) => {
    const users = await User.find().select("-__v");

    return res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  }
);

/**
 * GET SINGLE USER
 */
export const getAUser = tryCatch(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id).select("-__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  }
);

/**
 * LOGOUT
 */
export const logoutUser = tryCatch(
  async (_req: Request, res: Response) => {
    res.clearCookie("token");

    return res.status(200).json({
      message: "Logged out successfully",
    });
  }
);