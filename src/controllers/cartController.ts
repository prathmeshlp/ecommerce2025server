import { Request, Response } from "express";
import Cart from "../models/Cart";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";

export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const { userId, productId, quantity } = req.body;

  // Basic input validation
  if (!userId || !productId || !quantity || quantity <= 0) {
    throw new ApiError(400, "User ID, product ID, and a positive quantity are required", [], "INVALID_INPUT");
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [{ productId, quantity }] });
  } else {
    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }
  }

  await cart.save();

  // Populate product details for the response
  await cart.populate("items.productId");

  res.json(new ApiResponse(200, cart, "Item added to cart successfully"));
});

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Validate userId
  if (!userId) {
    throw new ApiError(400, "User ID is required", [], "MISSING_USER_ID");
  }

  const cart = await Cart.findOne({ userId }).populate("items.productId");
  if (!cart) {
    throw new ApiError(404, "Cart not found for this user", [], "CART_NOT_FOUND");
  }

  res.json(new ApiResponse(200, cart, "Cart retrieved successfully"));
});