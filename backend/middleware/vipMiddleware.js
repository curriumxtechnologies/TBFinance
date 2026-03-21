import asyncHandler from "express-async-handler";
import VipPayment from "../models/vipPaymentModel.js";

export const vipProtect = asyncHandler(async (req, res, next) => {
  const payment = await VipPayment.findOne({
    user: req.user._id,
    status: "approved",
  }).sort({ vipAccessExpiry: -1 });

  if (!payment || payment.vipAccessExpiry < new Date()) {
    res.status(403);
    throw new Error("VIP access required. Please subscribe to access this content.");
  }

  next();
});