import { Request, Response } from "express";
import Razorpay from "razorpay";
import Order from "../models/Order";
import crypto from "crypto";
import User, { IUser } from "../models/User";
import nodemailer from "nodemailer";
import { validateDiscount } from "./productController"; // Assuming this is exported from productController
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// interface DiscountResponse {
//   success: boolean;
//   discount?: {
//     code: string;
//     discountType: "percentage" | "fixed";
//     discountValue: number;
//     discountAmount: number;
//     newSubtotal: number;
//     discountedItems: { productId: string; discountedPrice: number }[];
//   };
//   error?: string; // Added for TypeScript safety
// }

// Placeholder for Razorpay order creation (adjusted to avoid duplicate instantiation)
const createRazorpayOrder = async (amount: number) => {
  return razorpay.orders.create({
    amount, // Amount in paise
    currency: "INR",
    receipt: `order_${Date.now()}`,
  });
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { items, shippingAddress, discountCode } = req.body;
  const user = req?.user as IUser;
  const userId = user?.id;

  // Authentication check
  if (!userId) {
    throw new ApiError(401, "Unauthorized: User not found", [], "UNAUTHORIZED");
  }

  // Input validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required and cannot be empty", [], "INVALID_ITEMS");
  }
  if (!shippingAddress || typeof shippingAddress !== "object") {
    throw new ApiError(400, "Shipping address is required and must be an object", [], "INVALID_SHIPPING_ADDRESS");
  }
  const requiredShippingFields = ["street", "city", "state", "zip", "country"];
  const missingFields = requiredShippingFields.filter((field) => !shippingAddress[field]);
  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      `Missing shipping address fields: ${missingFields.join(", ")}`,
      [],
      "MISSING_SHIPPING_FIELDS"
    );
  }

  const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  let discountAmount = 0;
  let discountedItems = items;

  if (discountCode) {
    const discountResponse = await validateDiscount({
      body: {
        code: discountCode,
        productIds: items.map((i: any) => i.productId),
        subtotal,
        items,
      },
    } as Request);

    if (!discountResponse.success) {
      throw new ApiError(400, discountResponse.error || "Invalid discount code", [], "INVALID_DISCOUNT_CODE");
    }
    discountAmount = discountResponse.discount!.discountAmount;

    // Update items with discounted prices
    discountedItems = items.map((item: any) => {
      const discounted = discountResponse.discount!.discountedItems.find(
        (d) => d.productId === item.productId
      );
      return discounted ? { ...item, price: discounted.discountedPrice } : item;
    });
  }

  const total = subtotal - discountAmount;

  const order = new Order({
    userId,
    items: discountedItems,
    shippingAddress,
    subtotal,
    discount: discountCode ? { code: discountCode, amount: discountAmount } : null,
    total,
    status: "pending",
  });

  await order.save();

  const razorpayOrder = await createRazorpayOrder(total * 100);

  const responseData = {
    orderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: total * 100, // Amount in paise
    key: process.env.RAZORPAY_KEY_ID,
  };

  res.json(new ApiResponse(201, responseData, "Order created successfully"));
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  // Input validation
  if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required payment verification fields", [], "MISSING_PAYMENT_FIELDS");
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await Order.findByIdAndUpdate(orderId, { paymentStatus: "failed" });
    throw new ApiError(400, "Invalid payment signature", [], "INVALID_SIGNATURE");
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { paymentId: razorpay_payment_id, paymentStatus: "completed" },
    { new: true }
  ).populate("items.productId");

  if (!order) {
    throw new ApiError(404, "Order not found", [], "ORDER_NOT_FOUND");
  }

  const user = await User.findById(order.userId);
  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  // Send confirmation email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "Order Confirmation",
    html: `
      <h2>Order #${order._id} Confirmed!</h2>
      <p>Thank you for your purchase. Your order has been successfully placed.</p>
      <p>Total: ₹${order.total.toLocaleString()}</p>
      <p>Shipping to: ${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.zip}, ${order.shippingAddress.country}</p>
      <p>Items:</p>
      <ul>
        ${order.items.map((item: any) => `<li>${item.productId.name} (x${item.quantity}) - ₹${(item.price * item.quantity).toLocaleString()}</li>`).join("")}
      </ul>
    `,
  };

  await transporter.sendMail(mailOptions);

  res.json(new ApiResponse(200, { success: true, order }, "Payment verified and order confirmed"));
});

export const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const userId = user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized: User not found", [], "UNAUTHORIZED");
  }

  const orders = await Order.find({ userId }).populate("items.productId").sort({ createdAt: -1 });

  res.json(new ApiResponse(200, orders, "User orders retrieved successfully"));
});