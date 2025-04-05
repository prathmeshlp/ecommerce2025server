import { Request, Response } from "express";
// import dotenv from "dotenv";
// dotenv.config();
import Razorpay from "razorpay";
import Order from "../models/Order";
import crypto from "crypto";
import User from "../models/User";
import nodemailer from "nodemailer";
import { validateDiscount } from "./productController";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";
import { IUser } from "../types/types";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

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
  const { items, shippingAddress, discountCode } = req.body; // discountCode is now string[]
  const user = req?.user as IUser;
  const userId = user?.id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized: User not found", [], "UNAUTHORIZED");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      400,
      "Items array is required and cannot be empty",
      [],
      "INVALID_ITEMS"
    );
  }
  if (!shippingAddress || typeof shippingAddress !== "object") {
    throw new ApiError(
      400,
      "Shipping address is required and must be an object",
      [],
      "INVALID_SHIPPING_ADDRESS"
    );
  }
  const requiredShippingFields = ["street", "city", "state", "zip", "country"];
  const missingFields = requiredShippingFields.filter(
    (field) => !shippingAddress[field]
  );
  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      `Missing shipping address fields: ${missingFields.join(", ")}`,
      [],
      "MISSING_SHIPPING_FIELDS"
    );
  }

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );

  let discountAmount = 0;
  let discountedItems = [...items];
  const appliedDiscounts: { code: string; amount: number }[] = [];

  if (discountCode && Array.isArray(discountCode) && discountCode.length > 0) {
    const discountedProductIds = new Set<string>(); // Track items already discounted
    for (const code of discountCode) {
      const discountResponse = await validateDiscount({
        body: {
          code,
          productIds: items.map((i: any) => i.productId),
          subtotal,
          items,
        },
      } as Request);

      if (!discountResponse.success || !discountResponse.discount) {
        throw new ApiError(
          400,
          discountResponse.error || `Invalid discount code: ${code}`,
          [],
          "INVALID_DISCOUNT_CODE"
        );
      }

      const discount = discountResponse.discount;
      // Filter out already discounted items
      const applicableItems = discount.discountedItems.filter(
        (di) => !discountedProductIds.has(di.productId)
      );
      if (applicableItems.length > 0) {
        const tempDiscountAmount = applicableItems.reduce((sum, discounted) => {
          const originalItem = items.find((i: any) => i.productId === discounted.productId);
          const originalPrice = originalItem ? originalItem.price : 0;
          const discountPerItem = originalPrice - discounted.discountedPrice;
          const quantity = originalItem ? originalItem.quantity : 1;
          return sum + discountPerItem * quantity;
        }, 0);

        discountAmount += tempDiscountAmount;
        appliedDiscounts.push({ code, amount: tempDiscountAmount });

        // Update discountedItems and track discounted productIds
        discountedItems = discountedItems.map((item: any) => {
          const discounted = applicableItems.find((d) => d.productId === item.productId);
          if (discounted) {
            discountedProductIds.add(item.productId);
            return { ...item, price: discounted.discountedPrice };
          }
          return item;
        });
      }
    }
  }

  const total = subtotal - discountAmount;

  const order = new Order({
    userId,
    items: discountedItems,
    shippingAddress,
    subtotal,
    discount: appliedDiscounts.length > 0 ? appliedDiscounts : null, // Store array of discounts
    total,
    status: "pending",
  });

  await order.save();

  const razorpayOrder = await createRazorpayOrder(total * 100);

  const responseData = {
    orderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: total * 100,
    key: process.env.RAZORPAY_KEY_ID,
  };

  res.json(new ApiResponse(201, responseData, "Order created successfully"));
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

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

// getUserOrders remains unchanged
export const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const userId = user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized: User not found", [], "UNAUTHORIZED");
  }

  const orders = await Order.find({ userId })
    .populate("items.productId")
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, orders, "User orders retrieved successfully"));
});