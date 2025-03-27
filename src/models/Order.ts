import mongoose, { Schema, Document } from "mongoose";
import { IOrder } from "../types/types";



const orderSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },
  },
  paymentStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  razorpayOrderId: { type: String },
  paymentId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IOrder>("Order", orderSchema);