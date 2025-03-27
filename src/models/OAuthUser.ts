import mongoose, { Schema, Document } from "mongoose";
import { OAuthUser } from "../types/types";


const OAUthUserSchema: Schema<OAuthUser> = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    photo: { type: String },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<OAuthUser>("OAuthUser", OAUthUserSchema);