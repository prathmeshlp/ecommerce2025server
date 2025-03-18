import mongoose, { Schema, Document } from "mongoose";

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
}

const cartSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ productId: { type: Schema.Types.ObjectId, ref: "Product" }, quantity: { type: Number, default: 1 } }],
});

export default mongoose.model<ICart>("Cart", cartSchema);