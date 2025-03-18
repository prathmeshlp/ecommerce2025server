import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/User";



const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser
  if (!user || user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export default adminMiddleware;