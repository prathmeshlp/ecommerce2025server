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

console.log(process.env.NODE_ENV); // Log the current environment

const app: Express = express();

// Environment variables with fallbacks
const PORT = process.env.PORT;
const CLIENT_URI = process.env.CLIENT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET!; 
const MONGO_URI = process.env.MONGO_URI;

// Middleware setup (shared for both envs)
app.use(cors({ origin: CLIENT_URI, credentials: true }));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } }));
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 },
  })
);
app.use(passport.initialize());
app.use(loggerMiddleware);

// Routes
app.get("/", (req, res) => {
  res.send("Ecommerce2025 Server is running!");
});
app.use("/api", routes);

// Error handling
app.use(errorHandler);

// Database connection function (reusable for both envs)
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 0) { // Not connected
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
  }
};

// Handler for Vercel (production) - defined at top level
const handler = async (req: any, res: any) => {
  try {
    await ensureDBConnection();
    app(req, res); // Handle request with Express
  } catch (err) {
    logger.error("Request handling failed", err);
    res.status(500).send("Internal Server Error");
  }
};

// Development: Start traditional server
if (process.env.NODE_ENV !== "production") {
  const startServer = async () => {
    try {
      await ensureDBConnection();
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
    } catch (err) {
      logger.error("Server startup failed", err);
      process.exit(1);
    }
  };

  startServer();
}

// Export handler for Vercel (production) - at top level
export default process.env.NODE_ENV === "production" ? handler : undefined;

// mongoose
//   .connect(process.env.MONGO_URI!)
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// // const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });