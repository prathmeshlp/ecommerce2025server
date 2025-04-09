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

// Env variables
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!SESSION_SECRET || !MONGO_URI) {
  logger.error("Missing required environment variables");
  process.exit(1);
}

// Use MongoDB persistent connection
let isConnected = false;
const connectToDB = async () => {
  if (isConnected || mongoose.connection.readyState !== 0) return;
  try {
    await connectDB();
    isConnected = true;
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

// Cold-start DB connection
connectToDB();

// Middleware
app.use(
  cors({
    origin: CLIENT_URI,
    credentials: true,
  })
);
app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  })
);
app.use(express.json({ limit: "10kb" }));

// Session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(loggerMiddleware);

// Timeout fallback (9s)
app.use((req, res, next) => {
  res.setTimeout(9000, () => {
    return res.status(503).json({ error: "Request timeout" });
  });
  next();
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "healthy" });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Ecommerce2025 Server is running!");
});

// Routes
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
}

// Exports for Vercel
export default serverless(app);
