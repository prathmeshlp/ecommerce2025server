import dotenv from "dotenv";
dotenv.config();
import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import winston from "winston";
import userRoutes from "./routes/userRoutes";
import productRoutes from "./routes/productRoutes";
import orderRoutes from "./routes/orderRoutes";
import connectDB from "./config/db";
import wishlistRoutes from "./routes/wishlistRoutes";
import cartRoutes from "./routes/cartRoutes";
import passport from "./config/passport";
import authMiddleware from "./middleware/authMiddleware";
import adminRoutes from "./routes/adminRoutes";
import adminMiddleware from "./middleware/adminMiddleware";

const app = express();
connectDB();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URI, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  })
);
app.use(passport.initialize());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/admin",authMiddleware,adminMiddleware, adminRoutes)
app.use("/api/products",authMiddleware, productRoutes);
app.use("/api/orders",authMiddleware, orderRoutes);
app.use("/api/cart",authMiddleware, cartRoutes);
app.use("/api/wishlist",authMiddleware, wishlistRoutes);
// app.use("/api/categories",authMiddleware, categoryRoutes);
app.use("/api/orders",authMiddleware, orderRoutes);
// MongoDB Connection

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
