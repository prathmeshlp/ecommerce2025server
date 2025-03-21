import { Request, Response } from "express";
import Razorpay from "razorpay";
import Order from "../models/Order";
import crypto from "crypto";
import User, { IUser } from "../models/User";
import nodemailer from "nodemailer";
import { validateDiscount } from "./productController";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});


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
}

// Placeholder for Razorpay order creation (adjust as per your setup)
const createRazorpayOrder = async (amount: number) => {
  const Razorpay = require("razorpay");
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpay.orders.create({
    amount,
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


export const createOrder = async (req: Request, res: Response) => {
  const { items, shippingAddress, discountCode } = req.body;
  const user = req?.user as IUser;
  const userId = user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not found." });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Items array is required and cannot be empty." });
  }
  if (!shippingAddress || typeof shippingAddress !== "object") {
    return res.status(400).json({ message: "Shipping address is required and must be an object." });
  }
  const requiredShippingFields = ["street", "city", "state", "zip", "country"];
  const missingFields = requiredShippingFields.filter((field) => !shippingAddress[field]);
  if (missingFields.length > 0) {
    return res.status(400).json({ message: `Missing shipping address fields: ${missingFields.join(", ")}` });
  }

  try {
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
        return res.status(400).json({ message: discountResponse.error });
      }
      discountAmount = discountResponse.discount!.discountAmount;

      // Update items with discounted prices where applicable
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
      items: discountedItems, // Store items with discounted prices
      shippingAddress,
      subtotal,
      discount: discountCode ? { code: discountCode, amount: discountAmount } : null,
      total,
      status: "pending",
    });

    await order.save();

    const razorpayOrder = await createRazorpayOrder(total * 100);
    res.json({
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: total * 100,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error", error: (error as Error).message });
  }
};


export const verifyPayment = async (req: Request, res: Response) => {
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { paymentId: razorpay_payment_id, paymentStatus: "completed" },
        { new: true }
      ).populate("items.productId");

      const user = await User.findById(order?.userId);

      // Send email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user?.email,
        subject: "Order Confirmation",
        html: `
          <h2>Order #${order?._id} Confirmed!</h2>
          <p>Thank you for your purchase. Your order has been successfully placed.</p>
          <p>Total: ₹${order?.total.toLocaleString()}</p>
          <p>Shipping to: ${order?.shippingAddress.street}, ${order?.shippingAddress.city}, ${order?.shippingAddress.state}, ${order?.shippingAddress.zip}, ${order?.shippingAddress.country}</p>
          <p>Items:</p>
          <ul>
            ${order?.items.map((item: any) => `<li>${item.productId.name} (x${item.quantity}) - ₹${(item.price * item.quantity).toLocaleString()}</li>`).join("")}
          </ul>
        `,
      };

      await transporter.sendMail(mailOptions);

      res.json({ success: true, order });
    } else {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: "failed" });
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const getUserOrders = async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const userId = user._id;
  try {
    const orders = await Order.find({ userId }).populate("items.productId").sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};