import express, { Express, Request, Response, NextFunction } from "express";
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

// Create Express app
const app: Express = express();

// Validate environment variables
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!SESSION_SECRET || !MONGO_URI) {
  logger.error("Missing required environment variables");
  process.exit(1);
}

// Middleware
app.use(cors({ 
  origin: CLIENT_URI, 
  credentials: true 
}));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"]
      },
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

// Session configuration
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
      mongoUrl: MONGO_URI,
      ttl: 14 * 24 * 60 * 60 // 14 days
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

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "healthy" });
});

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("Ecommerce2025 Server is running!");
});

app.use("/api", routes);

// Handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: "Not Found",
    error: {
      code: 404,
      message: "The requested resource was not found"
    }
  });
});

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

// Server configuration
let serverlessHandler: any;

if (process.env.NODE_ENV === "production") {
  // Prepare for serverless handler
  (async () => {
    try {
      await ensureDBConnection();
      serverlessHandler = serverless(app);
      logger.info("Serverless handler ready");
    } catch (err) {
      logger.error("Serverless initialization failed", err);
    }
  })();
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

export { app };
export default process.env.NODE_ENV === "production" ? serverlessHandler : app;