import { Router } from "express";
import { addReview, createProduct , getProducts, getReviews, getUniqueCategories, searchProducts, validateDiscount, validateDiscountHandler } from "../controllers/productController";
const router = Router();


router.post("/", createProduct);
router.get("/", getProducts);
router.get("/search", searchProducts);
router.get("/:productId/reviews", getReviews);
router.post("/:productId/reviews", addReview);
router.get("/categories", getUniqueCategories);
router.post("/validate", validateDiscountHandler);

export default router;