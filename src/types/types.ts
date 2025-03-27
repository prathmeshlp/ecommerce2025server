import mongoose, { Document } from "mongoose";



// // Extend Express Request type to include user
// declare global {
//   namespace Express {
//     interface Request {
//       user?: User;
//     }
//   }
// }

// Extend express-session to include passport user
declare module "express-session" {
  interface Session {
    passport?: { user?: string };
  }
}

export interface IAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface IUser extends Document {
  _id: string;
  email: string;
  username: string;
  password?: string; // Optional for OAuth users
  role: "user" | "admin";
  isBanned: boolean;
  address?: IAddress;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
}


export interface IWishlistItem {
  productId: mongoose.Types.ObjectId;
  addedAt?: Date;
}

export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  items: IWishlistItem[];
}


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

export interface DiscountResponse {
  success: boolean;
  discount?: {
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    discountAmount: number;
    newSubtotal: number;
    discountedItems: { productId: string; discountedPrice: number }[];
  };
  error?: string;
}


export interface OAuthUser extends Document {
  googleId: string;
  displayName: string;
  email: string;
  photo?: string;
  refreshToken: string;
}


export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  paymentStatus: "pending" | "completed" | "failed";
  razorpayOrderId?: string;
  paymentId?: string;
  createdAt: Date;
}

export interface IReview {
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface IProduct extends Document {
  name: string;
  price: number;
  description: string;
  image: string;
  category?: string;
  reviews: IReview[];
  stock: number;
  isDeleted: boolean;
}