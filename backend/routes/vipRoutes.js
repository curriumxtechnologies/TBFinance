import express from "express";
import {
  vipPayment,
  updateVipPaymentStatus,
  getMyVipStatus,
  getMyVipPayments,
  getAllVipPayments,
  uploadSignal,
  getSignals,
  getSignalById,
  updateSignal,
  deleteSignal,
} from "../controllers/vipController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import { vipProtect } from "../middleware/vipMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ✅ Multer storage for proof of payment
const paymentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_VIP_Payments",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf"],
  },
});

// ✅ Multer storage for signal images
const signalStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_Signals",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif"],
  },
});

const uploadPayment = multer({ storage: paymentStorage });
const uploadSignalImg = multer({ storage: signalStorage });

// ✅ User routes
router.post("/payment", protect, uploadPayment.single("proofOfPayment"), vipPayment);
router.get("/my-status", protect, getMyVipStatus);
router.get("/my-payments", protect, getMyVipPayments);

// ✅ VIP-only routes (must have active VIP access)
router.get("/signals", protect, vipProtect, getSignals);
router.get("/signals/:id", protect, vipProtect, getSignalById);

// ✅ Admin routes
router.get("/payments", protect, adminProtect, getAllVipPayments);
router.put("/payment/:id/status", protect, adminProtect, updateVipPaymentStatus);
router.post("/signals", protect, adminProtect, uploadSignalImg.single("image"), uploadSignal);
router.put("/signals/:id", protect, adminProtect, uploadSignalImg.single("image"), updateSignal);
router.delete("/signals/:id", protect, adminProtect, deleteSignal);

export default router;