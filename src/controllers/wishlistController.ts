import { Request, Response } from "express";
import Wishlist from "../models/Wishlist";
import Product from "../models/Product";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params; // From authMiddleware

  // Input validation
  if (!userId) {
    throw new ApiError(400, "User ID is required", [], "MISSING_USER_ID");
  }

  const wishlist = await Wishlist.findOne({ userId }).populate({
    path: "items.productId",
    select: "name price image", // Only fetch necessary fields
  });

  // Return empty array if no wishlist or no items
  if (!wishlist || wishlist.items.length === 0) {
    res.json(new ApiResponse(200, [], "Wishlist retrieved (empty)"));
    return;
  }

  // Filter out items where productId is null (e.g., product was deleted)
  const validItems = wishlist.items.filter((item) => item.productId !== null);

  res.json(new ApiResponse(200, validItems, "Wishlist retrieved successfully"));
});

export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { userId, productId } = req.body;

  // Input validation
  if (!userId || !productId) {
    throw new ApiError(400, "User ID and product ID are required", [], "INVALID_INPUT");
  }

  // Verify product exists before adding
  const productExists = await Product.findById(productId);
  if (!productExists) {
    throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
  }

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

  res.json(new ApiResponse(200, validItems, "Item added to wishlist successfully"));
});

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { userId, productId } = req.body;

  // Input validation
  if (!userId || !productId) {
    throw new ApiError(400, "User ID and product ID are required", [], "INVALID_INPUT");
  }

  const wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    throw new ApiError(404, "Wishlist not found", [], "WISHLIST_NOT_FOUND");
  }

  const initialLength = wishlist.items.length;
  wishlist.items = wishlist.items.filter((item) => item.productId.toString() !== productId);

  if (initialLength === wishlist.items.length) {
    throw new ApiError(404, "Product not found in wishlist", [], "PRODUCT_NOT_IN_WISHLIST");
  }

  await wishlist.save();
  await wishlist.populate({
    path: "items.productId",
    select: "name price image",
  });

  const validItems = wishlist.items.filter((item) => item.productId !== null);

  res.json(new ApiResponse(200, validItems, "Item removed from wishlist successfully"));
});