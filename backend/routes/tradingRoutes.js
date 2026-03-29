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
import { protect, adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

// User routes
router.get("/my", protect, getMyAccounts);

// Admin routes
router.get("/", adminProtect, getAllAccounts);
router.get("/eligible-for-live", adminProtect, getUsersEligibleForLive);
router.post("/demo/:userId", adminProtect, assignDemoAccount);
router.post("/live/:userId", adminProtect, assignLiveAccount);
router.put("/:accountId/balance", adminProtect, updateAccountBalance);
router.put("/:accountId", adminProtect, updateAccount);
router.delete("/:accountId", adminProtect, deleteAccount);

export default router;