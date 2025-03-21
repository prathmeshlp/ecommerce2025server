import { Request, Response } from "express";
import Product, { IProduct } from "../models/Product";
import Discount from "../models/Discount";

interface DiscountResponse {
  success: boolean;
  discount?: {
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    discountAmount: number;
    newSubtotal: number;
    discountedItems: { productId: string; discountedPrice: number }[];
  };
  error?: string;
}

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

export const validateDiscount = async (
  req: Request
): Promise<DiscountResponse> => {
  const { code, productIds, subtotal, items } = req.body;
  console.log("ValidateDiscount Request:", {
    code,
    productIds,
    subtotal,
    items,
  });
  if (
    !code ||
    !productIds ||
    !Array.isArray(productIds) ||
    typeof subtotal !== "number"
  ) {
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

  try {
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
    console.log(discount);
    const applicableProductStrings = (discount.applicableProducts || []).map(
      (id) => (id ? id.toString() : id)
    );
    console.log("Applicable Product Strings:", applicableProductStrings);
    // Filter applicable product IDs based on discount.applicableProducts
    const applicableProductIds = discount.applicableProducts?.length
      ? productIds.filter((id) => applicableProductStrings.includes(id))
      : productIds;

    console.log(applicableProductIds, "applicableProductIds");

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

    const products = await Product.find({
      _id: { $in: applicableProductIds },
    }).lean();
    if (products.length !== applicableProductIds.length) {
      return {
        success: false,
        error: "Some applicable product IDs are invalid.",
      };
    }

    const discountedItems = products.map((product) => {
      let discountedPrice = product.price;
      if (discount.discountType === "percentage") {
        discountedPrice = product.price * (1 - discount.discountValue / 100);
        if (discount.maxDiscountAmount) {
          discountedPrice = Math.max(
            product.price - discount.maxDiscountAmount,
            discountedPrice
          );
        }
      } else if (discount.discountType === "fixed") {
        discountedPrice = product.price - discount.discountValue;
      }
      return {
        productId: product._id.toString(),
        discountedPrice: Math.max(discountedPrice, 0),
      };
    });

    const discountAmount = discountedItems.reduce((sum, item) => {
      const cartItem = items.find((i: any) => i.productId === item.productId);
      const itemQuantity = cartItem ? cartItem.quantity : 1;
      const originalPrice = products.find(
        (p) => p._id.toString() === item.productId
      )!.price;
      return sum + (originalPrice - item.discountedPrice) * itemQuantity;
    }, 0);

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
  } catch (error) {
    console.error("Error validating discount:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: "Server error: " + errorMessage };
  }
};

export const validateDiscountHandler = async (req: Request, res: Response) => {
  const result = await validateDiscount(req);
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(result.error?.includes("Server error") ? 500 : 400).json(result);
  }
};

export const getProducts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    const totalProducts = await Product.countDocuments();
    const products = await Product.find().skip(skip).limit(limit).lean();

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
          discount.applicableProducts.some(
            (p) => p.toString() === product._id.toString()
          )
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

    res.json({
      products: productsWithCoupons,
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
};

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
    const categories = await Product.distinct("category").then((cats) =>
      cats.filter((cat) => cat)
    ); // Filter out null/undefined
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};
