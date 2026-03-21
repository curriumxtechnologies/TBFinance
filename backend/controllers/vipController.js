import asyncHandler from "express-async-handler";
import VipPayment from "../models/vipPaymentModel.js";
import Signal from "../models/signalModel.js";

// @desc    Submit VIP payment
// @route   POST /api/vip/payment
// @access  Private
const vipPayment = asyncHandler(async (req, res) => {
  const { amount, asset, network, transactionId, paymentMethod } = req.body;

  if (!amount || !asset || !network || !transactionId) {
    res.status(400);
    throw new Error("Amount, asset, network, and transaction ID are required");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  const existing = await VipPayment.findOne({ transactionId });
  if (existing) {
    res.status(400);
    throw new Error("This transaction ID has already been submitted");
  }

  const payment = await VipPayment.create({
    user: req.user._id,
    amount,
    asset,
    network,
    transactionId,
    paymentMethod: paymentMethod || "crypto",
    proofOfPayment: req.file?.path || "",
    status: "pending",
  });

  res.status(201).json(payment);
});

// @desc    Approve or reject VIP payment (admin)
// @route   PUT /api/vip/payment/:id/status
// @access  Private/Admin
const updateVipPaymentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be approved or rejected");
  }

  const payment = await VipPayment.findById(req.params.id);

  if (!payment) {
    res.status(404);
    throw new Error("VIP payment not found");
  }

  payment.status = status;

  if (status === "approved") {
    const now = new Date();
    payment.vipAccessStart  = now;
    payment.vipAccessExpiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  }

  const updated = await payment.save();
  res.status(200).json(updated);
});

// @desc    Get logged in user's VIP status
// @route   GET /api/vip/my-status
// @access  Private
const getMyVipStatus = asyncHandler(async (req, res) => {
  const payment = await VipPayment.findOne({
    user: req.user._id,
    status: "approved",
  }).sort({ vipAccessExpiry: -1 });

  if (!payment) {
    return res.status(200).json({ isVip: false, expiry: null, daysLeft: 0 });
  }

  const now = new Date();
  const isVip = payment.vipAccessExpiry > now;
  const daysLeft = isVip
    ? Math.ceil((payment.vipAccessExpiry - now) / (1000 * 60 * 60 * 24))
    : 0;

  res.status(200).json({
    isVip,
    expiry: payment.vipAccessExpiry,
    daysLeft,
    accessStart: payment.vipAccessStart,
  });
});

// @desc    Get logged in user's VIP payments
// @route   GET /api/vip/my-payments
// @access  Private
const getMyVipPayments = asyncHandler(async (req, res) => {
  const payments = await VipPayment.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json(payments);
});

// @desc    Get all VIP payments (admin)
// @route   GET /api/vip/payments
// @access  Private/Admin
const getAllVipPayments = asyncHandler(async (req, res) => {
  const payments = await VipPayment.find({})
    .populate("user", "name email phone profile")
    .sort({ createdAt: -1 });
  res.status(200).json(payments);
});

// @desc    Upload a signal (admin)
// @route   POST /api/vip/signals
// @access  Private/Admin
const uploadSignal = asyncHandler(async (req, res) => {
  const { pair, type, entry, takeProfits, stopLosses, description, status } = req.body;

  if (!pair || !type || !entry) {
    res.status(400);
    throw new Error("Pair, type, and entry are required");
  }

  if (!["buy", "sell"].includes(type.toLowerCase())) {
    res.status(400);
    throw new Error("Type must be buy or sell");
  }

  const parseTPs = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return val.split(",").map(v => v.trim()).filter(Boolean);
  };

  const signal = await Signal.create({
    pair:         pair.toUpperCase().trim(),
    type:         type.toLowerCase(),
    entry:        entry.trim(),
    takeProfits:  parseTPs(takeProfits),
    stopLosses:   parseTPs(stopLosses),
    description:  description || "",
    image:        req.file?.path || "",
    status:       status || "active",
    postedBy:     req.admin?._id || null,  // ← use req.admin not req.user
  });

  res.status(201).json(signal);
});

// @desc    Get all signals (VIP users only)
// @route   GET /api/vip/signals
// @access  Private/VIP
const getSignals = asyncHandler(async (req, res) => {
  const signals = await Signal.find({}).sort({ createdAt: -1 });
  res.status(200).json(signals);
});

// @desc    Get single signal
// @route   GET /api/vip/signals/:id
// @access  Private/VIP
const getSignalById = asyncHandler(async (req, res) => {
  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  res.status(200).json(signal);
});

// @desc    Update a signal (admin)
// @route   PUT /api/vip/signals/:id
// @access  Private/Admin
const updateSignal = asyncHandler(async (req, res) => {
  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  const { pair, type, entry, takeProfits, stopLosses, description, status } = req.body;

  const parseTPs = (val) => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.filter(Boolean);
    return val.split(",").map(v => v.trim()).filter(Boolean);
  };

  if (pair)   signal.pair  = pair.toUpperCase().trim();
  if (type)   signal.type  = type.toLowerCase();
  if (entry)  signal.entry = entry.trim();

  const parsedTPs = parseTPs(takeProfits);
  const parsedSLs = parseTPs(stopLosses);

  if (parsedTPs !== undefined) signal.takeProfits = parsedTPs;
  if (parsedSLs !== undefined) signal.stopLosses  = parsedSLs;

  if (description !== undefined) signal.description = description;
  if (status)                    signal.status      = status;
  if (req.file?.path)            signal.image       = req.file.path;

  const updated = await signal.save();
  res.status(200).json(updated);
});

// @desc    Delete a signal (admin)
// @route   DELETE /api/vip/signals/:id
// @access  Private/Admin
const deleteSignal = asyncHandler(async (req, res) => {
  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  await signal.deleteOne();
  res.status(200).json({ message: "Signal deleted successfully" });
});

export {
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
};