import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiUtils";
import { IUser } from "../types/types";

const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;

  if (!user || user?.role !== "admin") {
    throw new ApiError(403, "Admin access required", [], "ADMIN_ACCESS_REQUIRED");
  }

  next();
};

export default adminMiddleware;