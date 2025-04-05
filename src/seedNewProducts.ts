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

const seedNewProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("MongoDB connected");

    const newProducts: ProductData[] = [
      {
        name: "Gaming Keyboard",
        price: 5999,
        description: "RGB backlit mechanical gaming keyboard.",
        image: await uploadImageToCloudinary("gamingkeyboard.jpg", "gaming-keyboard"),
        category: "Accessories",
        stock: 20,
      },
      {
        name: "Denim Jacket",
        price: 3999,
        description: "Stylish denim jacket with button closure.",
        image: await uploadImageToCloudinary("denimjacket.jpg", "denim-jacket"),
        category: "Clothing",
        stock: 45,
      },
      {
        name: "Sports Sneakers",
        price: 5499,
        description: "Breathable sneakers for sports and casual wear.",
        image: await uploadImageToCloudinary("sportssneakers.jpg", "sports-sneakers"),
        category: "Footwear",
        stock: 30,
      },
      {
        name: "Sunglasses",
        price: 1499,
        description: "Polarized sunglasses with UV protection.",
        image: await uploadImageToCloudinary("sunglasses.jpg", "sunglasses"),
        category: "Accessories",
        stock: 80,
      },
      {
        name: "Electric Kettle",
        price: 2999,
        description: "1.5L stainless steel electric kettle.",
        image: await uploadImageToCloudinary("electrickettle.jpg", "electric-kettle"),
        category: "Home",
        stock: 40,
      },
      {
        name: "Dumbbell Set",
        price: 3999,
        description: "Adjustable dumbbell set for home workouts.",
        image: await uploadImageToCloudinary("dumbbellset.jpg", "dumbbell-set"),
        category: "Fitness",
        stock: 25,
      },
      {
        name: "USB-C Charger",
        price: 1999,
        description: "Fast-charging USB-C wall charger.",
        image: await uploadImageToCloudinary("usbccharger.jpg", "usb-c-charger"),
        category: "Electronics",
        stock: 60,
      },
      {
        name: "Woolen Scarf",
        price: 1299,
        description: "Warm woolen scarf for winter.",
        image: await uploadImageToCloudinary("woollenscarf.jpg", "woolen-scarf"),
        category: "Accessories",
        stock: 70,
      },
      {
        name: "Ceramic Mug",
        price: 799,
        description: "350ml ceramic mug with handle.",
        image: await uploadImageToCloudinary("ceramicmug.jpg", "ceramic-mug"),
        category: "Home",
        stock: 90,
      },
      {
        name: "Resistance Bands",
        price: 1499,
        description: "Set of 5 resistance bands for fitness.",
        image: await uploadImageToCloudinary("resistancebands.jpg", "resistance-bands"),
        category: "Fitness",
        stock: 50,
      },
    ];

    await Product.insertMany(newProducts);
    console.log("10 new products seeded successfully");

    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error seeding new products:", error);
    process.exit(1);
  }
};

seedNewProducts();