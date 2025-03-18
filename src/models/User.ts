import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";
import { timeStamp } from "console";

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

const userSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true }, // Keep required, handle in OAuth
    password: { type: String, required: false }, // Changed to optional
    role: { type: String, enum: ["user", "admin"], default: "user" },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String },
    },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
) {
  return this.password
    ? bcrypt.compare(candidatePassword, this.password)
    : false;
};

export default mongoose.model<IUser>("User", userSchema);
