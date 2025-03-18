import { Router } from "express";
import { addReview, createProduct, deleteProduct, getProducts, getReviews, getUniqueCategories, searchProducts, updateProduct } from "../controllers/productController";
const router = Router();


router.post("/", createProduct);
router.get("/", getProducts);
router.get("/search", searchProducts);
router.get("/:productId/reviews", getReviews);
router.post("/:productId/reviews", addReview);
router.get("/categories", getUniqueCategories);

export default router;