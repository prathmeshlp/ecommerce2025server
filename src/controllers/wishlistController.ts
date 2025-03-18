import { Request, Response } from "express";
import Wishlist from "../models/Wishlist";
import Product from "../models/Product";

export const getWishlist = async (req: Request, res: Response) => {
  const userId = req.params.userId ; // From authMiddleware
  try {
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.productId",
      select: "name price image", // Only fetch necessary fields
    });
    if (!wishlist || wishlist.items.length === 0) return res.json([]); // Empty array if no wishlist
    // Filter out items where productId is null (e.g., product was deleted)
    const validItems = wishlist.items.filter((item) => item.productId !== null);
    res.json(validItems);
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const addToWishlist = async (req: Request, res: Response) => {
  const { userId, productId } = req.body;
  try {
    // Verify product exists before adding
    const productExists = await Product.findById(productId);
    if (!productExists) return res.status(404).json({ message: "Product not found" });

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [{ productId }] });
    } else {
      if (!wishlist.items.some((item) => item.productId.toString() === productId)) {
        wishlist.items.push({ productId });
      }
    }
    await wishlist.save();
    await wishlist.populate({
      path: "items.productId",
      select: "name price image",
    });
    const validItems = wishlist.items.filter((item) => item.productId !== null);
    res.json(validItems);
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  const { userId, productId } = req.body;
  console.log(userId,productId)
  try {
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });
    wishlist.items = wishlist.items.filter((item) => item.productId.toString() !== productId);
    await wishlist.save();
    await wishlist.populate({
      path: "items.productId",
      select: "name price image",
    });
    const validItems = wishlist.items.filter((item) => item.productId !== null);
    res.json(validItems);
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
};