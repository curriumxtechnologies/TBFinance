import express from "express";
import {
  assignDemoAccount,
  assignLiveAccount,
  updateAccountBalance,
  updateAccount,
  getMyAccounts,
  getAllAccounts,
  getUsersEligibleForLive,
  deleteAccount,
} from "../controllers/tradingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ User routes
router.get("/my", protect, getMyAccounts);

// ✅ Admin routes
router.get("/", protect, adminProtect, getAllAccounts);
router.get("/eligible-for-live", protect, adminProtect, getUsersEligibleForLive);
router.post("/demo/:userId", protect, adminProtect, assignDemoAccount);
router.post("/live/:userId", protect, adminProtect, assignLiveAccount);
router.put("/:accountId/balance", protect, adminProtect, updateAccountBalance);
router.put("/:accountId", protect, adminProtect, updateAccount);
router.delete("/:accountId", protect, adminProtect, deleteAccount);

export default router;