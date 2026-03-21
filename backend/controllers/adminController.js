import asyncHandler from "express-async-handler";
import Admin from "../models/adminModel.js";
import generateAdminToken from "../utils/generateAdminToken.js";

// @desc    Register admin
// @route   POST /api/admin/register
// @access  Public (protected by secret key)
const registerAdmin = asyncHandler(async (req, res) => {
  const name      = req.body.name;
  const email     = req.body.email;
  const password  = req.body.password;
  const secretKey = req.body.secretKey;

  if (!secretKey || secretKey.trim() !== process.env.ADMIN_SECRET.trim()) {
    res.status(401);
    throw new Error("Invalid secret key");
  }

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    res.status(400);
    throw new Error("Admin with this email already exists");
  }

  const admin = await Admin.create({ name, email, password });
  const token = generateAdminToken(res, admin._id);

  res.status(201).json({
    _id:   admin._id,
    name:  admin.name,
    email: admin.email,
    token,
  });
});

// @desc    Login admin
// @route   POST /api/admin/login
// @access  Public
const adminLogin = asyncHandler(async (req, res) => {
  const email    = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const admin = await Admin.findOne({ email });

  if (!admin || !(await admin.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateAdminToken(res, admin._id);

  res.status(200).json({
    _id:   admin._id,
    name:  admin.name,
    email: admin.email,
    token,
  });
});

// @desc    Logout admin
// @route   POST /api/admin/logout
// @access  Private/Admin
const adminLogout = asyncHandler(async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("admin_jwt", "", {
    httpOnly: true,
    expires: new Date(0),
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  res.status(200).json({ message: "Admin logged out successfully" });
});

export { registerAdmin, adminLogin, adminLogout };