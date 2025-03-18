import express from "express";
import {
  createOrder,
  getUserOrders,
  verifyPayment,
} from "../controllers/orderController";

const router = express.Router();

router.post("/create", createOrder);
router.post("/verify", verifyPayment);
router.get("/user", getUserOrders);

export default router;
