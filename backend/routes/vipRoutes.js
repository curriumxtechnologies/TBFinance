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
import { protect, adminProtect } from "../middleware/authMiddleware.js";
import { vipProtect } from "../middleware/vipMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const paymentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_VIP_Payments",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf"],
  },
});

const signalStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_Signals",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif"],
  },
});

const uploadPayment   = multer({ storage: paymentStorage });
const uploadSignalImg = multer({ storage: signalStorage });

// ✅ User routes
router.post("/payment",     protect, uploadPayment.single("proofOfPayment"), vipPayment);
router.get("/my-status",    protect, getMyVipStatus);
router.get("/my-payments",  protect, getMyVipPayments);

// ✅ Admin routes — MUST come before VIP routes
router.get("/admin/signals",      adminProtect, getSignals);
router.get("/admin/signals/:id",  adminProtect, getSignalById);
router.get("/payments",           adminProtect, getAllVipPayments);
router.put("/payment/:id/status", adminProtect, updateVipPaymentStatus);
router.post("/signals",           adminProtect, uploadSignalImg.single("image"), uploadSignal);
router.put("/signals/:id",        adminProtect, uploadSignalImg.single("image"), updateSignal);
router.delete("/signals/:id",     adminProtect, deleteSignal);

// ✅ VIP user routes
router.get("/signals",     protect, vipProtect, getSignals);
router.get("/signals/:id", protect, vipProtect, getSignalById);

export default router;