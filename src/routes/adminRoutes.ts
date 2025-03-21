import express from "express";
import {
  bulkUpdateDiscounts,
  bulkUpdateOrders,
  bulkUpdateProducts,
  createDiscount,
  deleteDiscount,
  deleteOrder,
  deleteUser,
  deleteUserAdmin,
  getAdminDashboard,
  getDiscounts,
  getOrders,
  getUniqueCategories,
  getUsersAdmin,
  updateDiscount,
  updateOrder,
  updateUserAdmin,
} from "../controllers/adminController";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../controllers/productController";

const router = express.Router();

router.get("/dashboard", getAdminDashboard);
router.get("/users", getUsersAdmin);
router.put("/users/:userId", updateUserAdmin);
router.delete("/users/:userId", deleteUserAdmin);
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);
router.get("/categories", getUniqueCategories);
router.get("/orders", getOrders);
router.put("/orders/:orderId", updateOrder);
router.delete("/orders/:orderId", deleteOrder);
router.post("/orders/bulk", bulkUpdateOrders);
router.post("/products/bulk", bulkUpdateProducts);
router.get("/discounts", getDiscounts);
router.post("/discounts", createDiscount);
router.put("/discounts/:discountId", updateDiscount);
router.delete("/discounts/:discountId", deleteDiscount);
router.post("/discounts/bulk",bulkUpdateDiscounts);

export default router;
