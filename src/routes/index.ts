import { Router } from "express";
import userRoutes from "./userRoutes";
import productRoutes from "./productRoutes";
import orderRoutes from "./orderRoutes";
import wishlistRoutes from "./wishlistRoutes";
import cartRoutes from "./cartRoutes";
import adminRoutes from "./adminRoutes";
import authMiddleware from "../middleware/authMiddleware";
import adminMiddleware from "../middleware/adminMiddleware";

const router = Router();

// Public routes
router.use("/users", userRoutes);

// Protected routes
router.use("/products", authMiddleware, productRoutes);
router.use("/orders", authMiddleware, orderRoutes);
router.use("/cart", authMiddleware, cartRoutes);
router.use("/wishlist", authMiddleware, wishlistRoutes);
router.use("/admin", authMiddleware, adminMiddleware, adminRoutes);

export default router;