import { Router } from "express";
import { register, login, getUser, updateUser, googleAuth, googleAuthCallback, logout } from "../controllers/userController";
import authMiddleware from "../middleware/authMiddleware";
import passport from "passport";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/:id", authMiddleware, getUser);
router.put("/:id", authMiddleware, updateUser);
router.get("/auth/google", googleAuth);
router.get("/auth/google/callback", passport.authenticate("google", { session: true }), googleAuthCallback);
router.post("/logout", authMiddleware, logout);



export default router;