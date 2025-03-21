import { Request, Response } from "express";
import User from "../models/User";
import Order from "../models/Order";
import Product from "../models/Product";
import Discount from "../models/Discount";

export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    // Total Users
    const users = await User.countDocuments();

    // Total Orders
    const orders = await Order.countDocuments();

    // Total Revenue (sum of completed orders)
    const revenueData = await Order.aggregate([
      { $match: { paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const revenue = revenueData[0]?.total || 0;

    // Total Products
    const products = await Product.countDocuments();

    // Recent Orders (last 5)
    const recentOrders = await Order.find()
      .populate("userId", "email username")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Top Products (by total units sold and revenue)
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { name: "$product.name", totalSold: 1, totalRevenue: 1 } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);

    // User Growth (last 6 months)
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 6 },
      { $project: { month: "$_id", count: 1, _id: 0 } },
    ]);

    // Revenue Trend (last 6 months, completed orders only)
    const revenueTrend = await Order.aggregate([
      { $match: { paymentStatus: "completed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 6 },
      { $project: { month: "$_id", total: 1, _id: 0 } },
    ]);

    res.json({
      users,
      orders,
      revenue,
      products,
      recentOrders,
      topProducts,
      userGrowth,
      revenueTrend,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password"); // Exclude password
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { email, username, role, isBanned } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { email, username, role, isBanned },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10; // Default 10 per page
  const skip = (page - 1) * limit;

  try {
    const total = await Product.countDocuments();
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const { name, price, image, category, stock, } = req.body;

  try {
    const product = new Product({ name, price, image, category, stock });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { name, price, image, category, stock } = req.body;

  try {
    const product = await Product.findByIdAndUpdate(
      productId,
      { name, price, image, category, stock },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;

  try {
    const product = await Product.findByIdAndDelete(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUniqueCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Product.distinct("category").then((cats) => cats.filter((cat) => cat)); // Filter out null/undefined
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Orders
export const getOrders = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const { paymentStatus, search } = req.query;

  try {
    let query: any = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { _id: { $regex: search, $options: "i" } }, // Case-insensitive Order ID search
        { "userId.email": { $regex: search, $options: "i" } }, // Search by email (requires population)
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("userId", "email")
      .populate("items.productId", "name price image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      orders,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const bulkUpdateOrders = async (req: Request, res: Response) => {
  const { orderIds, action, paymentStatus } = req.body; // action: "update" or "delete"

  try {
    if (action === "update") {
      if (!paymentStatus) return res.status(400).json({ message: "Payment status required for update" });
      const result = await Order.updateMany(
        { _id: { $in: orderIds } },
        { paymentStatus },
        { runValidators: true }
      );
      res.json({ message: `${result.modifiedCount} orders updated successfully` });
    } else if (action === "delete") {
      const result = await Order.deleteMany({ _id: { $in: orderIds } });
      res.json({ message: `${result.deletedCount} orders deleted successfully` });
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update order status
export const updateOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { paymentStatus } = req.body; // Only allow updating paymentStatus for simplicity

  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus },
      { new: true, runValidators: true }
    )
      .populate("userId", "email")
      .populate("items.productId", "name price image");

    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete order
export const deleteOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUsersAdmin = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    const total = await User.countDocuments();
    const users = await User.find()
      .select("-password") // Exclude password
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      users,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user details
export const updateUserAdmin = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { email, username, role, isBanned, address } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { email, username, role, isBanned, address },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user
export const deleteUserAdmin = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const bulkUpdateProducts = async (req: Request, res: Response) => {
  const { productIds, stock } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: "Product IDs are required and must be an array." });
  }
  if (stock === undefined || stock < 0 || isNaN(stock)) {
    return res.status(400).json({ message: "Stock must be a non-negative number." });
  }

  try {
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { stock },
      { runValidators: true }
    );
    res.json({ message: `${result.modifiedCount} products updated successfully.` });
  } catch (error) {
    console.error("Error in bulk update products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// List all discounts with pagination
export const getDiscounts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    const total = await Discount.countDocuments();
    const discounts = await Discount.find()
      .populate("applicableProducts", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      discounts,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching discounts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a discount
export const createDiscount = async (req: Request, res: Response) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    startDate,
    endDate,
    isActive,
    applicableProducts,
  } = req.body;

  console.log(req.body,"reqcoupon")
  try {
    if (applicableProducts) {
      const validProducts = await Product.find({ _id: { $in: applicableProducts } });
      if (validProducts.length !== applicableProducts.length) {
        return res.status(400).json({ message: "One or more product IDs are invalid." });
      }
    }

    const discount = new Discount({
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
      applicableProducts,
    });
    await discount.save();
    res.status(201).json(discount);
  } catch (error) {
    console.error("Error creating discount:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a discount
export const updateDiscount = async (req: Request, res: Response) => {
  const { discountId } = req.params;
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    startDate,
    endDate,
    isActive,
    applicableProducts,
  } = req.body;

  try {
    if (applicableProducts) {
      const validProducts = await Product.find({ _id: { $in: applicableProducts } });
      if (validProducts.length !== applicableProducts.length) {
        return res.status(400).json({ message: "One or more product IDs are invalid." });
      }
    }

    const discount = await Discount.findByIdAndUpdate(
      discountId,
      {
        code,
        description,
        discountType,
        discountValue,
        minOrderValue,
        maxDiscountAmount,
        startDate,
        endDate,
        isActive,
        applicableProducts,
      },
      { new: true, runValidators: true }
    ).populate("applicableProducts", "name");

    if (!discount) return res.status(404).json({ message: "Discount not found" });
    res.json(discount);
  } catch (error) {
    console.error("Error updating discount:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a discount
export const deleteDiscount = async (req: Request, res: Response) => {
  const { discountId } = req.params;

  try {
    const discount = await Discount.findByIdAndDelete(discountId);
    if (!discount) return res.status(404).json({ message: "Discount not found" });
    res.json({ message: "Discount deleted successfully" });
  } catch (error) {
    console.error("Error deleting discount:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const bulkUpdateDiscounts = async (req: Request, res: Response) => {
  const { discountIds, isActive } = req.body;

  if (!discountIds || !Array.isArray(discountIds) || discountIds.length === 0) {
    return res.status(400).json({ message: "Discount IDs are required and must be an array." });
  }
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ message: "isActive must be a boolean." });
  }

  try {
    const result = await Discount.updateMany(
      { _id: { $in: discountIds } },
      { isActive },
      { runValidators: true }
    );
    res.json({ message: `${result.modifiedCount} discounts updated successfully.` });
  } catch (error) {
    console.error("Error in bulk update discounts:", error);
    res.status(500).json({ message: "Server error" });
  }
};