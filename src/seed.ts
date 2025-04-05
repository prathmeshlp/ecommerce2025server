import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import Product from "./models/Product";
import cloudinary from "./config/cloudinary";
import path from "path";
import fs from "fs";


interface ProductData {
  name: string;
  price: number;
  description: string;
  image: string;
  category?: string; // Changed to string
  stock: number;
  reviews?: { userId: mongoose.Types.ObjectId; rating: number; comment: string; createdAt: Date }[];
}

const uploadImageToCloudinary = async (filePath: string, publicId: string): Promise<string> => {
  try {
    const absolutePath = path.resolve(__dirname, "..", "images", filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const result = await cloudinary.uploader.upload(absolutePath, {
      public_id: `products/${publicId}`,
      folder: "e-shop",
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Error uploading ${publicId} to Cloudinary:`, error);
    throw error;
  }
};

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("MongoDB connected");

    await Product.deleteMany({});
    console.log("Existing products cleared");

    const dummyUserId = new mongoose.Types.ObjectId();

    const dummyProducts: ProductData[] = [
      {
        name: "Wireless Mouse",
        price: 2499,
        description: "Ergonomic wireless mouse with adjustable DPI.",
        image: await uploadImageToCloudinary("wirelessmouse.jpg", "wireless-mouse"),
        category: "Electronics", // Now a string
        stock: 50,
        reviews: [
          { userId: dummyUserId, rating: 4, comment: "Great mouse!", createdAt: new Date() },
          { userId: dummyUserId, rating: 5, comment: "Love it!", createdAt: new Date() },
        ],
      },
      {
        name: "Bluetooth Headphones",
        price: 4999,
        description: "Noise-canceling over-ear Bluetooth headphones.",
        image: await uploadImageToCloudinary("earphone-3789599_1280.jpg", "bluetooth-headphones"),
        category: "Electronics",
        stock: 30,
        reviews: [
          { userId: dummyUserId, rating: 3, comment: "Good sound, but heavy.", createdAt: new Date() },
        ],
      },
      {
        name: "Cotton T-Shirt",
        price: 999,
        description: "Comfortable 100% cotton t-shirt in multiple colors.",
        image: await uploadImageToCloudinary("tshirt.png", "cotton-tshirt"),
        category: "Clothing",
        stock: 100,
      },
      {
        name: "Running Shoes",
        price: 6499,
        description: "Lightweight running shoes with cushioned sole.",
        image: await uploadImageToCloudinary("shoe-629643_1280.jpg", "running-shoes"),
        category: "Footwear",
        stock: 20,
        reviews: [
          { userId: dummyUserId, rating: 5, comment: "Perfect fit!", createdAt: new Date() },
          { userId: dummyUserId, rating: 4, comment: "Very comfy.", createdAt: new Date() },
        ],
      },
      {
        name: "Stainless Steel Water Bottle",
        price: 1999,
        description: "Durable 500ml stainless steel water bottle.",
        image: await uploadImageToCloudinary("waterbottle.jpg", "water-bottle"),
        category: "Accessories",
        stock: 75,
      },
      {
        name: "Laptop Backpack",
        price: 2999,
        description: "Water-resistant backpack with laptop compartment.",
        image: await uploadImageToCloudinary("bag.jpg", "laptop-backpack"),
        category: "Accessories",
        stock: 40,
      },
      {
        name: "Smart Watch",
        price: 9999,
        description: "Fitness tracking smart watch with heart rate monitor.",
        image: await uploadImageToCloudinary("smartwatch.jpg", "smart-watch"),
        category: "Electronics",
        stock: 15,
        reviews: [
          { userId: dummyUserId, rating: 2, comment: "Battery life poor.", createdAt: new Date() },
        ],
      },
      {
        name: "Leather Wallet",
        price: 2499,
        description: "Slim leather wallet with RFID blocking.",
        image: await uploadImageToCloudinary("letherwallet.jpg", "leather-wallet"),
        category: "Accessories",
        stock: 60,
      },
      {
        name: "Desk Lamp",
        price: 3499,
        description: "Adjustable LED desk lamp with touch control.",
        image: await uploadImageToCloudinary("tablelamp.jpg", "desk-lamp"),
        category: "Home",
        stock: 25,
      },
      {
        name: "Yoga Mat",
        price: 1999,
        description: "Non-slip yoga mat with carrying strap.",
        image: await uploadImageToCloudinary("yogamat.jpg", "yoga-mat"),
        category: "Fitness",
        stock: 35,
      },
    ];

    await Product.insertMany(dummyProducts);
    console.log("Products seeded successfully");

    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
