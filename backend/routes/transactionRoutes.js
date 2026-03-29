import express from "express";
import {
  depositPayment,
  getMyTransactions,
  getMyTotalDeposit,
  getUserTotalByAdmin,
  setUserBalanceByAdmin,
  getAllTransactions,
  updateTransactionStatus,
  getTransactionById,
} from "../controllers/transactionController.js";
import { protect, adminProtect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_Transactions",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf"],
  },
});

const upload = multer({ storage });

// User routes
router.post("/deposit", protect, upload.single("proofOfPayment"), depositPayment);
router.get("/my", protect, getMyTransactions);
router.get("/my/total", protect, getMyTotalDeposit);
router.get("/:id", protect, getTransactionById);

// Admin routes
router.get("/", adminProtect, getAllTransactions);
router.get("/admin/user-total/:userId", adminProtect, getUserTotalByAdmin);
router.post("/admin/set-balance/:userId", adminProtect, setUserBalanceByAdmin);
router.put("/:id/status", adminProtect, updateTransactionStatus);

export default router;