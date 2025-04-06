import express, { Express } from "express";
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

const app: Express = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET || "default-secret"; // Fallback for dev
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/myapp";

const startServer = async () => {
  try {
    const retryConnectDB = async (retries = 5, delay = 5000) => {
      for (let i = 0; i < retries; i++) {
        try {
          await connectDB();
          logger.info("Database connected successfully");
          return;
        } catch (err) {
          logger.error(`DB connection attempt ${i + 1} failed`, err);
          if (i === retries - 1) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };
    await retryConnectDB();
  } catch (err) {
    logger.error("Database connection failed after retries", err);
    process.exit(1);
  }

  app.use(cors({ origin: CLIENT_URI, credentials: true }));
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } }));
  app.use(compression());
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  }));
  app.use(express.json({ limit: "10kb" }));
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 },
  }));
  app.use(passport.initialize());
  app.use(loggerMiddleware);

  app.use("/api", routes);
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down server...");
    server.close(async () => {
      logger.info("Server closed");
      try {
        await mongoose.connection.close();
        logger.info("Database connection closed");
      } catch (err) {
        logger.error("Error closing database", err);
      }
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

app.get("/", (req, res) => {
  res.json({ message: "Hello from server!" });
});

startServer();