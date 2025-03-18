import { Request, Response } from "express";
import Product, { IProduct } from "../models/Product";

export const createProduct = async (req: Request, res: Response) => {
  const { name, price, description, image, category } = req.body;
  try {
    const product = new Product({ name, price, description, image, category });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: "Product creation failed", error });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { name, price, image, category, stock } = req.body;

  try {
    const product = await Product.findByIdAndUpdate(
      productId,
      { name, price, image, category, stock },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments({ isDeleted: false });
    const products = await Product.find({ isDeleted: false })
      // .populate("categoryId", "name")
      .skip(skip)
      .limit(limit);

    const productsWithRatings = products.map((product) => {
      const totalRatings = product.reviews.length;
      const avgRating =
        totalRatings > 0
          ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings
          : 0;
      return {
        ...product.toJSON(),
        avgRating: parseFloat(avgRating.toFixed(1)),
      };
    });

    res.json({
      products: productsWithRatings,
      totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;

  try {
    const product = await Product.findByIdAndDelete(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server error" });
  }
}

export const searchProducts = async (req: Request, res: Response) => {
  const { q } = req.query;
  try {
    const products = await Product.find({ $text: { $search: q as string } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Search failed", error });
  }
};

export const getReviews = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product.reviews);
};

export const addReview = async (req: Request, res: Response) => {
  const { userId, rating, comment } = req.body;
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: "Product not found" });
  product.reviews.push({ userId, rating, comment, createdAt: new Date() });
  await product.save();
  res.status(201).json(product.reviews);
};

export const getUniqueCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Product.distinct("category").then((cats) => cats.filter((cat) => cat)); // Filter out null/undefined
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};