import mongoose, { Schema, Document } from "mongoose";
import { IDiscount } from "../types/types";



const discountSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

export default mongoose.model<IDiscount>("Discount", discountSchema);