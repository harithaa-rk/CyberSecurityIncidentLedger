const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { registerUser, loginUser, getMe } = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

// ── Rate limiter for auth routes: 10 requests per 15 minutes per IP ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);

// Protected routes
router.get("/me", verifyToken, getMe);

module.exports = router;