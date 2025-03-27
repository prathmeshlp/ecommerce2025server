import mongoose, { Schema, Document } from "mongoose";
import { ICart } from "../types/types";


const cartSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ productId: { type: Schema.Types.ObjectId, ref: "Product" }, quantity: { type: Number, default: 1 } }],
});

export default mongoose.model<ICart>("Cart", cartSchema);