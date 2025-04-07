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

// Create Express app
const app: Express = express();

// Load environment variables
const PORT = process.env.PORT || 5000;
const CLIENT_URI = process.env.CLIENT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET!;
const MONGO_URI = process.env.MONGO_URI!;

// Middleware
app.use(cors({ origin: CLIENT_URI, credentials: true }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"] },
    },
  })
);
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
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(loggerMiddleware);

// Routes
app.get("/", (req, res) => {
  res.send("Ecommerce2025 Server is running!");
});
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// Connect to MongoDB
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await connectDB();
      logger.info("MongoDB connected");
    } catch (err) {
      logger.error("Failed to connect to MongoDB", err);
      throw err;
    }
  }
};

// Vercel-compatible handler
const serverless = require("serverless-http");
let serverlessHandler: any;

if (process.env.NODE_ENV === "production") {
  // Prepare for serverless handler (only once)
   ensureDBConnection();
  serverlessHandler = serverless(app);
}

if (process.env.NODE_ENV !== "production") {
  const startServer = async () => {
    try {
      await ensureDBConnection();
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
    } catch (err) {
      logger.error("Startup failed", err);
      process.exit(1);
    }
  };

  startServer();
}

export default process.env.NODE_ENV === "production" ? serverlessHandler : undefined;
