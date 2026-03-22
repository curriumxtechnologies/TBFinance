import express from "express";
import {
  createRecoveryRequest,
  getMyRecoveryRequests,
  getAllRecoveryRequests,
  updateRecoveryRequestStatus,
} from "../controllers/recoveryRequestController.js";
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

const recoveryPaymentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "The_Brave_Recovery_Payments",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf"],
  },
});

const uploadRecoveryPayment = multer({ storage: recoveryPaymentStorage });

// User routes
router.post(
  "/",
  protect,
  uploadRecoveryPayment.single("proofOfPayment"),
  createRecoveryRequest
);

router.get("/my", protect, getMyRecoveryRequests);

// Admin routes
router.get("/", adminProtect, getAllRecoveryRequests);
router.put("/:id/status", adminProtect, updateRecoveryRequestStatus);

export default router;