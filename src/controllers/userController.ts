import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import passport from "passport";

export const register = async (req: Request, res: Response) => {
  const { email,username, password } = req.body;
  try {
    const user = await User.findOne({ email });
    console.log(user,"user");
    console.log(req.body,"req.body");
    if (user) return res.status(400).json({ message: "User already exists" });
    const newUser = new User({ email,username, password });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    res.status(201).json({ token });
  } catch (error) {
    res.status(400).json({ message: "User registration failed", error });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error });
  }
};

export const getUser = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const updateUser = async (req: Request, res: Response) => {
  console.log(req.user,"req.user")
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};


export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

export const googleAuthCallback = (req: Request, res: Response) => {
  if (req.user) {
    const user = req.user as IUser;
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    res.redirect(`${process.env.CLIENT_URI}/auth/callback?token=${token}`);
  } else {
    res.status(401).json({ message: "Google authentication failed" });
  }
};

export const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
};