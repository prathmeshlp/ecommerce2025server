import { Request, Response, NextFunction } from "express";
import logger from "./logger";
import crypto from "crypto";

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncHandler = (requestHandler: RequestHandler, options = { logErrors: true }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(req, res, next))
      .catch((err) => {
        const errorDetails = {
          message: err.message,
          method: req.method,
          url: req.url,
          stack: err.stack,
        };
        if (options.logErrors) {
          logger.error("Request failed", errorDetails);
        }
        const productionError = process.env.NODE_ENV === "production" 
          ? new ApiError(err.statusCode || 500, err.message) 
          : err;
        next(productionError);
      });
  };
};

class ApiResponse<T = any> {
  constructor(
    public statusCode: number,
    public data: T,
    public message: string = "Success",
    public metadata: Record<string, any> = {}
  ) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.metadata.timestamp = new Date().toISOString();
    this.metadata.requestId = metadata.requestId || crypto.randomUUID();
  }

  public success: boolean;
}

class ApiError extends Error {
 
  constructor(
    public statusCode: number,
    public message: string = "Something went wrong",
    public errors: any[] = [],
    public errorCode?: string,
    public data?: null,
    public success?: boolean,
    stack?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    this.errorCode = errorCode;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    if (process.env.NODE_ENV === "production") {
      logger.error("API Error", { statusCode, message, errors, errorCode, stack: this.stack });
    }
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      success: this.success,
      errors: this.errors,
      ...(this.errorCode && { errorCode: this.errorCode }),
      ...(process.env.NODE_ENV !== "production" && { stack: this.stack }),
    };
  }
}

export { asyncHandler, ApiResponse, ApiError };