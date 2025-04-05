import express, { Request, Response } from "express";
// import dotenv from "dotenv";
// dotenv.config();
import passport from "passport";
import { asyncHandler, ApiResponse, ApiError } from "../utils/apiUtils";

const router = express.Router();

// Google OAuth login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    accessType: "offline",
    prompt: "consent",
  })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: process.env.CLIENT_URI }),
  asyncHandler(async (req: Request, res: Response) => {
    // Successful authentication, redirect to home
    res.redirect(`${process.env.CLIENT_URI}/app/home`);
  })
);

// Logout
router.get(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    // Wrap logout in a Promise for asyncHandler compatibility
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) {
          reject(new ApiError(500, "Logout failed", [], "LOGOUT_FAILED"));
        } else {
          resolve();
        }
      });
    });

    res.json(new ApiResponse(200, { success: true }, "Logged out successfully"));
  })
);

// Get current user
router.get(
  "/user",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      // Return null user with success (not an error)
      res.json(new ApiResponse(200, null, "No authenticated user"));
      return;
    }
    res.json(new ApiResponse(200, req.user, "User retrieved successfully"));
  })
);

export default router;