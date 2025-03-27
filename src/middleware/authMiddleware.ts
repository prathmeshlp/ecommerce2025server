import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { ApiError } from "../utils/apiUtils";



const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Check for JWT in Authorization header
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      const user = await User.findById(decoded.id);
      if (!user) {
        throw new ApiError(401, "Unauthorized: User not found", [], "USER_NOT_FOUND");
      }
      req.user = user;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, "Invalid token", [], "INVALID_TOKEN");
      }
      throw error; // Re-throw unexpected errors
    }
  }

  // Check for session-based auth (Google OAuth)
  if (req.session.passport?.user) {
    const user = await User.findById(req.session.passport.user);
    if (!user) {
      throw new ApiError(401, "Unauthorized: User not found", [], "USER_NOT_FOUND");
    }
    req.user = user;
    return next();
  }

  throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
};

export default authMiddleware;