import express, { Express } from "express";
import dotenv from "dotenv";
dotenv.config();
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression"; // Performance optimization
import rateLimit from "express-rate-limit"; // Security
import passport from "./config/passport";
import connectDB from "./config/db";
import logger from "./utils/logger";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";

const app: Express = express();

// Database connection
const startServer = async () => {
  try {
    await connectDB();
    logger.info("Database connected successfully");
  } catch (err) {
    logger.error("Database connection failed", err);
    process.exit(1);
  }

  // Middleware
  app.use(
    cors({
      origin: process.env.CLIENT_URI,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(compression()); // Gzip compression
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
    })
  );
  app.use(express.json({ limit: "10kb" })); // Limit payload size
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );
  app.use(passport.initialize());
  app.use(loggerMiddleware);

  // Routes
  app.use("/api", routes);

  // Error handling
  app.use(errorHandler);

  // Start server
  const server = app.listen(process.env.PORT, () => {
    logger.info(`Server running on port ${process.env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down server...");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

// Start the server
startServer();