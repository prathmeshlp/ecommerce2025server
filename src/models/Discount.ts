import mongoose, { Schema, Document } from "mongoose";

export interface IDiscount extends Document {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  applicableProducts?: string[]; // Array of Product IDs
}

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