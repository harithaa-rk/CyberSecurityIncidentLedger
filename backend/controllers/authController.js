const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ─────────────────────────────────────────────
// Helper: generate JWT
// ─────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ─────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    // ── Field validation ──
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address." });
    }

    // ── Duplicate check ──
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    // ── Hash password ──
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Create user ──
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "User",
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT
// @access  Public
// ─────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Field validation ──
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // ── Find user ──
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    // ── Check if account is active ──
    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been deactivated. Contact support.",
      });
    }

    // ── Check if account is locked ──
    if (user.isLocked) {
      const remainingMs = user.lockUntil - Date.now();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        message: `Account temporarily locked due to multiple failed attempts. Try again in ${remainingMins} minute(s).`,
        locked: true,
        lockUntil: user.lockUntil,
      });
    }

    // ── Verify password ──
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Increment failed attempts
      await user.incLoginAttempts();

      const attemptsLeft = 5 - (user.loginAttempts + 1);
      const message =
        attemptsLeft > 0
          ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining before account lockout.`
          : "Invalid email or password. Account has been locked for 15 minutes.";

      return res.status(401).json({ message });
    }

    // ── Successful login — reset attempts ──
    await User.findByIdAndUpdate(user._id, {
      $set: {
        loginAttempts: 0,
        lockUntil: null,
        lastLogin: new Date(),
      },
    });

    const token = generateToken(user);

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user profile
// @access  Private
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -loginAttempts -lockUntil"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};