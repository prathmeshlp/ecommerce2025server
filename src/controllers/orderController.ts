import { Request, Response } from "express";
import Razorpay from "razorpay";
import Order from "../models/Order";
import crypto from "crypto";
import User, { IUser } from "../models/User";
import nodemailer from "nodemailer";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const createOrder = async (req: Request, res: Response) => {
  const { items, shippingAddress } = req.body;
  const user = req.user as IUser;
  const userId = user?._id;

  try {
    const total = items.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);

    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    const order = new Order({
      userId,
      items,
      total,
      shippingAddress,
      razorpayOrderId: razorpayOrder.id,
    });

    await order.save();
    res.json({ orderId: order._id, razorpayOrderId: razorpayOrder.id, amount: total * 100, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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