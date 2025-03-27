// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { ApiError } from "../utils/apiUtils";

export const errorHandler = (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });
  const status = (err as ApiError).statusCode || 500;
  const response = err instanceof ApiError ? err.toJSON() : { error: err.message };
  res.status(status).json(response);
};