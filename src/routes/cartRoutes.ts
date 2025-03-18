import { Router } from "express";
import { addToCart, getCart } from "../controllers/cartController";

const router = Router();

router.post("/", addToCart);
router.get("/:userId", getCart);

export default router;