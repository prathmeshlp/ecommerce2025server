import mongoose, { Schema, Document } from "mongoose";
import { IWishlist } from "../types/types";



const wishlistSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      addedAt: { type: Date, default: Date.now },
    },
  ],
});

export default mongoose.model<IWishlist>("Wishlist", wishlistSchema);