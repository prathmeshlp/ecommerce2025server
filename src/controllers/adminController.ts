import { Request, Response } from "express";
import User from "../models/User";
import Order from "../models/Order";
import Product from "../models/Product";
import Discount from "../models/Discount";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";
import mongoose from "mongoose";

//Admin Dashboard
export const getAdminDashboard = asyncHandler(
  async (req: Request, res: Response) => {
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
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
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

    const dashboardData = {
      users,
      orders,
      revenue,
      products,
      recentOrders,
      topProducts,
      userGrowth,
      revenueTrend,
    };

    res.json(
      new ApiResponse(
        200,
        dashboardData,
        "Admin dashboard data retrieved successfully"
      )
    );
  }
);

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { email, username, role, isBanned } = req.body;

  const user = await User.findByIdAndUpdate(
    userId,
    { email, username, role, isBanned },
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  res.json(new ApiResponse(200, user, "User updated successfully"));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  res.json(
    new ApiResponse(
      200,
      { message: "User deleted successfully" },
      "User deleted successfully"
    )
  );
});

// Products

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments();
  const products = await Product.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const responseData = {
    products,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };

  res.json(
    new ApiResponse(200, responseData, "Products retrieved successfully")
  );
});

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, price, stock, image, category, description } = req.body;
    // Input validation
    if (!name || !price || price < 0 || !description) {
      throw new ApiError(
        400,
        "Name and a non-negative price are required",
        [],
        "INVALID_INPUT"
      );
    }

    const product = new Product({
      name,
      price,
      stock,
      image,
      category,
      description,
    });
    await product.save();

    res.json(new ApiResponse(201, product, "Product created successfully"));
  }
);

export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const { name, price, image, category, stock, description } = req.body;
    const product = await Product.findByIdAndUpdate(
      productId,
      { name, price, image, category, stock, description },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
    }

    res.json(new ApiResponse(200, product, "Product updated successfully"));
  }
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      throw new ApiError(404, "Product not found", [], "PRODUCT_NOT_FOUND");
    }

    res.json(
      new ApiResponse(
        200,
        { message: "Product deleted successfully" },
        "Product deleted successfully"
      )
    );
  }
);

// Categories

export const getUniqueCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const categories = await Product.distinct("category").then((cats) =>
      cats.filter((cat) => cat)
    );
    res.json(
      new ApiResponse(200, categories, "Categories retrieved successfully")
    );
  }
);

// Orders

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const { paymentStatus, search } = req.query;

  // Build initial match conditions
  const matchConditions: any = {};
  if (paymentStatus) {
    matchConditions.paymentStatus = paymentStatus;
  }

  // Aggregation pipeline for fetching orders
  const pipeline: mongoose.PipelineStage[] = [
    { $match: matchConditions },
    {
      $lookup: {
        from: "users", // Must match your User collection name in MongoDB
        localField: "userId",
        foreignField: "_id",
        as: "userId",
      },
    },
    { $unwind: "$userId" },
    {
      $lookup: {
        from: "products", // Must match your Product collection name in MongoDB
        localField: "items.productId",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    ...(search
      ? [
          {
            $match: {
              $or: [
                { _id: { $regex: new RegExp(search as string, "i") } },
                {
                  "userId.email": { $regex: new RegExp(search as string, "i") },
                },
              ],
            },
          },
        ]
      : []),
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        userId: { _id: "$userId._id", email: "$userId.email" },
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              productId: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$productDetails",
                      cond: { $eq: ["$$this._id", "$$item.productId"] },
                    },
                  },
                  0,
                ],
              },
              quantity: "$$item.quantity",
              price: "$$item.price",
            },
          },
        },
        total: 1,
        shippingAddress: 1,
        paymentStatus: 1,
        razorpayOrderId: 1,
        paymentId: 1,
        createdAt: 1,
      },
    },
  ];

  // Fetch orders
  const orders = await Order.aggregate(pipeline);

  // Total count pipeline
  const totalPipeline = [
    { $match: matchConditions },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userId",
      },
    },
    { $unwind: "$userId" },
    ...(search
      ? [
          {
            $match: {
              $or: [
                { _id: { $regex: new RegExp(search as string, "i") } },
                {
                  "userId.email": { $regex: new RegExp(search as string, "i") },
                },
              ],
            },
          },
        ]
      : []),
    { $count: "total" },
  ];
  const totalResult = await Order.aggregate(totalPipeline);
  const total = totalResult.length > 0 ? totalResult[0].total : 0;

  const responseData = {
    orders,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };

  res.json(new ApiResponse(200, responseData, "Orders retrieved successfully"));
});

export const bulkUpdateOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderIds, action, paymentStatus } = req.body;

    if (action === "update") {
      if (!paymentStatus) {
        throw new ApiError(
          400,
          "Payment status required for update",
          [],
          "MISSING_PAYMENT_STATUS"
        );
      }
      const result = await Order.updateMany(
        { _id: { $in: orderIds } },
        { paymentStatus },
        { runValidators: true }
      );
      res.json(
        new ApiResponse(
          200,
          { message: `${result.modifiedCount} orders updated successfully` },
          "Orders updated successfully"
        )
      );
    } else if (action === "delete") {
      const result = await Order.deleteMany({ _id: { $in: orderIds } });
      res.json(
        new ApiResponse(
          200,
          { message: `${result.deletedCount} orders deleted successfully` },
          "Orders deleted successfully"
        )
      );
    } else {
      throw new ApiError(400, "Invalid action", [], "INVALID_ACTION");
    }
  }
);

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { paymentStatus } = req.body;

  const order = await Order.findByIdAndUpdate(
    orderId,
    { paymentStatus },
    { new: true, runValidators: true }
  )
    .populate("userId", "email")
    .populate("items.productId", "name price image");

  if (!order) {
    throw new ApiError(404, "Order not found", [], "ORDER_NOT_FOUND");
  }

  res.json(new ApiResponse(200, order, "Order updated successfully"));
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await Order.findByIdAndDelete(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found", [], "ORDER_NOT_FOUND");
  }

  res.json(
    new ApiResponse(
      200,
      { message: "Order deleted successfully" },
      "Order deleted successfully"
    )
  );
});

export const getUsersAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find()
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const responseData = {
      users,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };

    res.json(
      new ApiResponse(200, responseData, "Users retrieved successfully")
    );
  }
);

export const updateUserAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { email, username, role, isBanned, address } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { email, username, role, isBanned, address },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
    }

    res.json(new ApiResponse(200, user, "User updated successfully"));
  }
);

export const deleteUserAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
    }

    res.json(
      new ApiResponse(
        200,
        { message: "User deleted successfully" },
        "User deleted successfully"
      )
    );
  }
);

export const bulkUpdateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { productIds, stock } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      throw new ApiError(
        400,
        "Product IDs are required and must be an array",
        [],
        "INVALID_PRODUCT_IDS"
      );
    }
    if (stock === undefined || stock < 0 || isNaN(stock)) {
      throw new ApiError(
        400,
        "Stock must be a non-negative number",
        [],
        "INVALID_STOCK"
      );
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { stock },
      { runValidators: true }
    );

    res.json(
      new ApiResponse(
        200,
        { message: `${result.modifiedCount} products updated successfully` },
        "Products updated successfully"
      )
    );
  }
);

export const getDiscounts = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await Discount.countDocuments();
    const discounts = await Discount.find()
      .populate("applicableProducts", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const responseData = {
      discounts,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };

    res.json(
      new ApiResponse(200, responseData, "Discounts retrieved successfully")
    );
  }
);

export const createDiscount = asyncHandler(
  async (req: Request, res: Response) => {
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

    if (applicableProducts) {
      const validProducts = await Product.find({
        _id: { $in: applicableProducts },
      });
      if (validProducts.length !== applicableProducts.length) {
        throw new ApiError(
          400,
          "One or more product IDs are invalid",
          [],
          "INVALID_PRODUCT_IDS"
        );
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

    res.json(new ApiResponse(201, discount, "Discount created successfully"));
  }
);

export const updateDiscount = asyncHandler(
  async (req: Request, res: Response) => {
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

    if (applicableProducts) {
      const validProducts = await Product.find({
        _id: { $in: applicableProducts },
      });
      if (validProducts.length !== applicableProducts.length) {
        throw new ApiError(
          400,
          "One or more product IDs are invalid",
          [],
          "INVALID_PRODUCT_IDS"
        );
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

    if (!discount) {
      throw new ApiError(404, "Discount not found", [], "DISCOUNT_NOT_FOUND");
    }

    res.json(new ApiResponse(200, discount, "Discount updated successfully"));
  }
);

export const deleteDiscount = asyncHandler(
  async (req: Request, res: Response) => {
    const { discountId } = req.params;

    const discount = await Discount.findByIdAndDelete(discountId);
    if (!discount) {
      throw new ApiError(404, "Discount not found", [], "DISCOUNT_NOT_FOUND");
    }

    res.json(
      new ApiResponse(
        200,
        { message: "Discount deleted successfully" },
        "Discount deleted successfully"
      )
    );
  }
);

export const bulkUpdateDiscounts = asyncHandler(
  async (req: Request, res: Response) => {
    const { discountIds, isActive } = req.body;

    if (
      !discountIds ||
      !Array.isArray(discountIds) ||
      discountIds.length === 0
    ) {
      throw new ApiError(
        400,
        "Discount IDs are required and must be an array",
        [],
        "INVALID_DISCOUNT_IDS"
      );
    }
    if (typeof isActive !== "boolean") {
      throw new ApiError(
        400,
        "isActive must be a boolean",
        [],
        "INVALID_IS_ACTIVE"
      );
    }

    const result = await Discount.updateMany(
      { _id: { $in: discountIds } },
      { isActive },
      { runValidators: true }
    );

    res.json(
      new ApiResponse(
        200,
        { message: `${result.modifiedCount} discounts updated successfully` },
        "Discounts updated successfully"
      )
    );
  }
);
