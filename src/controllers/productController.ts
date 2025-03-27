import { Request, Response } from "express";
import Product, { IProduct } from "../models/Product";
import Discount from "../models/Discount";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";
import { DiscountResponse } from "../types/types";


export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, price, description, image, category } = req.body;

  // Input validation
  if (!name || !price || price < 0) {
    throw new ApiError(400, "Name and a non-negative price are required", [], "INVALID_INPUT");
  }

  const product = new Product({ name, price, description, image, category });
  await product.save();

  res.json(new ApiResponse(201, product, "Product created successfully"));
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { name, price, image, category, stock } = req.body;

  // Input validation
  if (price !== undefined && price < 0) {
    throw new ApiError(400, "Price must be non-negative", [], "INVALID_PRICE");
  }
  if (stock !== undefined && stock < 0) {
    throw new ApiError(400, "Stock must be non-negative", [], "INVALID_STOCK");
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { name, price, image, category, stock },
    { new: true, runValidators: true }
  );

  if (!product) {
    throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
  }

  res.json(new ApiResponse(200, product, "Product updated successfully"));
});

export const validateDiscount = async (req: Request): Promise<DiscountResponse> => {
  const { code, productIds, subtotal, items } = req.body;

  // Input validation
  if (!code || !productIds || !Array.isArray(productIds) || typeof subtotal !== "number") {
    return {
      success: false,
      error: "Code, productIds (array), and subtotal (number) are required.",
    };
  }
  if (!items || !Array.isArray(items)) {
    return {
      success: false,
      error: "Items array is required for quantity calculation.",
    };
  }

  console.log("Input:", { code, productIds, subtotal, items });

  const now = new Date();
  const discount = await Discount.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  }).lean();

  if (!discount) {
    return { success: false, error: "Invalid or expired discount code." };
  }
  console.log("Discount:", discount);

  const applicableProductStrings = (discount.applicableProducts || []).map((id) =>
    id ? id.toString() : id
  );
  const applicableProductIds = discount.applicableProducts?.length
    ? productIds.filter((id) => applicableProductStrings.includes(id))
    : productIds;

  if (applicableProductIds.length === 0) {
    return {
      success: false,
      error: "Discount does not apply to any items in your cart.",
    };
  }

  if (discount.minOrderValue && subtotal < discount.minOrderValue) {
    return {
      success: false,
      error: `Minimum order value of ₹${discount.minOrderValue} required for this discount.`,
    };
  }

  const products = await Product.find({ _id: { $in: applicableProductIds } }).lean();
  if (products.length !== applicableProductIds.length) {
    return {
      success: false,
      error: "Some applicable product IDs are invalid.",
    };
  }
  console.log("Products:", products);

  const discountedItems = products.map((product) => {
    const originalPrice = product.price;
    let discountedPrice = originalPrice;
    let discountPerItem = 0;

    if (discount.discountType === "percentage") {
      discountPerItem = originalPrice * (discount.discountValue / 100);
      discountedPrice = originalPrice - discountPerItem;
      if (discount.maxDiscountAmount && discountPerItem > discount.maxDiscountAmount) {
        discountPerItem = discount.maxDiscountAmount;
        discountedPrice = originalPrice - discountPerItem;
      }
    } else if (discount.discountType === "fixed") {
      discountPerItem = discount.discountValue;
      discountedPrice = originalPrice - discountPerItem;
      if (discount.maxDiscountAmount && discountPerItem > discount.maxDiscountAmount) {
        discountPerItem = discount.maxDiscountAmount;
        discountedPrice = originalPrice - discountPerItem;
      }
    }

    // Ensure discounted price is not negative
    discountedPrice = Math.max(discountedPrice, 0);

    console.log(`Product ${product._id}:`, {
      originalPrice,
      discountPerItem,
      discountedPrice,
    });

    return {
      productId: product._id.toString(),
      discountedPrice: Number(discountedPrice.toFixed(2)),
    };
  });

  const discountAmount = discountedItems.reduce((sum, item) => {
    const cartItem = items.find((i: any) => i.productId === item.productId);
    const itemQuantity = cartItem ? cartItem.quantity : 1;
    const originalPrice = products.find((p) => p._id.toString() === item.productId)!.price;
    const discountPerItem = originalPrice - item.discountedPrice;
    console.log(`Item ${item.productId}:`, {
      originalPrice,
      discountedPrice: item.discountedPrice,
      discountPerItem,
      quantity: itemQuantity,
    });
    return sum + discountPerItem * itemQuantity;
  }, 0);

  console.log("Total Discount Amount:", discountAmount);

  return {
    success: true,
    discount: {
      code: discount.code,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmount: Number(discountAmount.toFixed(2)),
      newSubtotal: Number((subtotal - discountAmount).toFixed(2)),
      discountedItems,
    },
  };
};

export const validateDiscountHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await validateDiscount(req);
  if (result.success) {
    res.json(new ApiResponse(200, result, "Discount validated successfully"));
  } else {
    throw new ApiError(
      result.error?.includes("Server error") ? 500 : 400,
      result.error || "Discount validation failed",
      [],
      result.error?.includes("Server error") ? "SERVER_ERROR" : "INVALID_DISCOUNT"
    );
  }
});

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const totalProducts = await Product.countDocuments();
  const products = await Product.find().lean(); // Fetch all products

  const now = new Date();
  const activeDiscounts = await Discount.find({
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  }).lean();

  const productsWithCoupons = products.map((product) => {
    const applicableDiscount = activeDiscounts.find(
      (discount) =>
        !discount.applicableProducts ||
        discount.applicableProducts.length === 0 ||
        discount.applicableProducts.some((p) => p.toString() === product._id.toString())
    );
    if (applicableDiscount) {
      return {
        ...product,
        discount: {
          code: applicableDiscount.code,
          discountType: applicableDiscount.discountType,
          discountValue: applicableDiscount.discountValue,
        },
      };
    }
    return product;
  });

  const responseData = {
    products: productsWithCoupons,
    totalProducts,
    currentPage: 1, // Default to 1 since no server-side pagination
    totalPages: 1, // Will be recalculated on frontend
  };

  res.json(new ApiResponse(200, responseData, "Products retrieved successfully"));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  const product = await Product.findByIdAndDelete(productId);
  if (!product) {
    throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
  }

  res.json(new ApiResponse(200, { message: "Product deleted successfully" }, "Product deleted successfully"));
});

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    throw new ApiError(400, "Search query (q) is required and must be a string", [], "INVALID_QUERY");
  }

  const products = await Product.find({ $text: { $search: q as string } });

  res.json(new ApiResponse(200, products, "Products search completed successfully"));
});

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
  }

  res.json(new ApiResponse(200, product.reviews, "Reviews retrieved successfully"));
});

export const addReview = asyncHandler(async (req: Request, res: Response) => {
  const { userId, rating, comment } = req.body;
  const { productId } = req.params;

  // Input validation
  if (!userId || !rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "User ID and rating (1-5) are required", [], "INVALID_REVIEW_INPUT");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
  }

  product.reviews.push({ userId, rating, comment, createdAt: new Date() });
  await product.save();

  res.json(new ApiResponse(201, product.reviews, "Review added successfully"));
});

export const getUniqueCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Product.distinct("category").then((cats) => cats.filter((cat) => cat));
  res.json(new ApiResponse(200, categories, "Categories retrieved successfully"));
});