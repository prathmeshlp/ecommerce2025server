// Top-level imports and dotenv
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "./config/passport";
import connectDB from "./config/db";
import logger from "./utils/logger";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";
import mongoose from "mongoose";
import serverless from "serverless-http";

// Create app
const app: Express = express();

// Env check
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!SESSION_SECRET || !MONGO_URI) {
  logger.error("Missing required environment variables");
  process.exit(1);
}

// Middleware
app.use(cors({ origin: CLIENT_URI, credentials: true }));
app.use(helmet());
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: "10kb" }));

// Session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Passport + logger
app.use(passport.initialize());
app.use(passport.session());
app.use(loggerMiddleware);

// Ensure DB middleware
const ensureDBConnectionMiddleware = async (req: Request, res: Response, next: any) => {
  if (mongoose.connection.readyState === 0) {
    try {
      await connectDB();
      logger.info("MongoDB connected");
    } catch (error) {
      logger.error("MongoDB connection error", error);
      return res.status(500).json({ error: "Database connection failed" });
    }
  }
  next();
};
app.use(ensureDBConnectionMiddleware);

// Health check + routes
app.get("/health", (req, res) => res.status(200).json({ status: "healthy" }));
app.get("/", (req, res) => res.send("Ecommerce2025 Server is running!"));
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// Local dev only
if (process.env.NODE_ENV !== "production") {
  const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  };
  startServer();
}

// Exports
export { app };
export default serverless(app);
