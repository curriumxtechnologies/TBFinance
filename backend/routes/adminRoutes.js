import express from "express";
import {
  registerAdmin,
  adminLogin,
  adminLogout,
} from "../controllers/adminController.js";
import { adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login",    adminLogin);
router.post("/logout",   adminProtect, adminLogout);

export default router;