// import { Request, Response } from "express";
// import Category from "../models/Category";

// export const getCategories = async (req: Request, res: Response) => {
//   try {
//     const categories = await Category.find();
//     if (!categories.length) {
//       return res.status(404).json({ message: "No categories found" });
//     }
//     res.json(categories);
//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };