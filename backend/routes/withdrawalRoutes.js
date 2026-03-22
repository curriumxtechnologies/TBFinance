import express from "express";
import {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  updateWithdrawalStatus,
} from "../controllers/withdrawalController.js";
import { protect, adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/",           protect, requestWithdrawal);
router.get("/my",          protect, getMyWithdrawals);
router.get("/",            adminProtect, getAllWithdrawals);
router.put("/:id/status",  adminProtect, updateWithdrawalStatus);

export default router;