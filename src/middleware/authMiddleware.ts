import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module "express-session" {
  interface Session {
    passport?: { user?: string };
  }
}

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Check for JWT in Authorization header
  const token = req.header("Authorization")?.replace("Bearer ", "");
  // console.log(token,"token");
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      // console.log(decoded,"decoded");
      const user = await User.findById(decoded.id);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  }

  // Check for session-based auth (Google OAuth)
  if (req.session.passport?.user) {
    const user = await User.findById(req.session.passport.user);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    req.user = user;
    return next();
  }

  res.status(401).json({ message: "Authentication required" });
};

export default authMiddleware;