import express from "express";
import {
  deleteOrder,
  deleteUser,
  getDashboard,
  getOrders,
  getUniqueCategories,
  getUsers,
  updateOrder,
  updateUser,
} from "../controllers/adminController";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../controllers/productController";

const router = express.Router();

router.get("/dashboard", getDashboard);
router.get("/users", getUsers);
router.put("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);
router.get("/categories", getUniqueCategories);
router.get("/orders", getOrders);
router.put("/orders/:orderId", updateOrder);
router.delete("/orders/:orderId", deleteOrder);

export default router;
