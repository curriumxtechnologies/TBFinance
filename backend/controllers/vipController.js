import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import VipPayment from "../models/vipPaymentModel.js";
import Signal from "../models/signalModel.js";
import TradeAcceptance from "../models/tradeAcceptanceModel.js";
import SignalOutcome from "../models/signalOutcomeModel.js";
import Transaction from "../models/transactionModel.js";
import Withdrawal from "../models/withdrawalModel.js";
import User from "../models/userModel.js";

// ─── Helper: compute a user's available balance ───────────────────────────────
const getUserAvailableBalance = async (userId) => {
  const depositResult = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: "deposit",
        status: "approved",
      },
    },
    { $group: { _id: null, totalDeposited: { $sum: "$creditedAmount" } } },
  ]);

  const withdrawalResult = await Withdrawal.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    { $group: { _id: null, totalReserved: { $sum: "$amount" } } },
  ]);

  const totalDeposited = depositResult[0]?.totalDeposited || 0;
  const totalReserved = withdrawalResult[0]?.totalReserved || 0;

  return totalDeposited - totalReserved;
};

// ─── Helper: check if all take profits have been hit ──────────────────────────
const areAllTpsHit = async (signalId) => {
  const signal = await Signal.findById(signalId);
  if (!signal || !signal.takeProfits || signal.takeProfits.length === 0) return false;
  
  const outcomes = await SignalOutcome.find({ 
    signal: signalId,
    outcomeType: "profit"
  });
  
  const hitLabels = new Set(outcomes.map(o => o.label));
  return signal.takeProfits.every(tp => hitLabels.has(tp.label));
};

// ─── Helper: check if a specific level has already been hit ───────────────────
const isLevelAlreadyHit = async (signalId, levelLabel, outcomeType) => {
  const outcome = await SignalOutcome.findOne({
    signal: signalId,
    label: levelLabel,
    outcomeType: outcomeType
  });
  return !!outcome;
};

// ─── VIP PAYMENT ──────────────────────────────────────────────────────────────

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
    payment.vipAccessStart = now;
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

// ─── SIGNALS ──────────────────────────────────────────────────────────────────

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

  const parseLevels = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  };

  const signal = await Signal.create({
    pair: pair.toUpperCase().trim(),
    type: type.toLowerCase(),
    entry: entry.trim(),
    takeProfits: parseLevels(takeProfits),
    stopLosses: parseLevels(stopLosses),
    description: description || "",
    image: req.file?.path || "",
    status: status || "active",
    postedBy: req.admin?._id || null,
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

// @desc    Get single signal (with acceptance status for the logged-in user)
// @route   GET /api/vip/signals/:id
// @access  Private/VIP
const getSignalById = asyncHandler(async (req, res) => {
  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  const acceptance = await TradeAcceptance.findOne({
    signal: signal._id,
    user: req.user._id,
  });

  res.status(200).json({
    ...signal.toObject(),
    userAccepted: !!acceptance,
    userAcceptanceStatus: acceptance?.status || null,
    userTotalPercentageApplied: acceptance?.totalPercentageApplied || 0,
  });
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

  const parseLevels = (val) => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  };

  if (pair) signal.pair = pair.toUpperCase().trim();
  if (type) signal.type = type.toLowerCase();
  if (entry) signal.entry = entry.trim();

  const parsedTPs = parseLevels(takeProfits);
  const parsedSLs = parseLevels(stopLosses);

  if (parsedTPs !== undefined) signal.takeProfits = parsedTPs;
  if (parsedSLs !== undefined) signal.stopLosses = parsedSLs;

  if (description !== undefined) signal.description = description;
  if (status) signal.status = status;
  if (req.file?.path) signal.image = req.file.path;

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

// ─── TRADE ACCEPTANCE ─────────────────────────────────────────────────────────

// @desc    Accept a signal (trader confirms they are taking this trade)
// @route   POST /api/vip/signals/:id/accept
// @access  Private/VIP
const acceptSignal = asyncHandler(async (req, res) => {
  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  if (signal.status === "closed" || signal.status === "completed") {
    res.status(400);
    throw new Error("This signal is no longer accepting trades");
  }

  // Check if already accepted
  const existing = await TradeAcceptance.findOne({
    signal: signal._id,
    user: req.user._id,
  });

  if (existing) {
    res.status(400);
    throw new Error("You have already accepted this signal");
  }

  // Snapshot the user's current available balance
  const availableBalance = await getUserAvailableBalance(req.user._id);

  if (availableBalance <= 0) {
    res.status(400);
    throw new Error("You have no available balance to trade with");
  }

  const acceptance = await TradeAcceptance.create({
    signal: signal._id,
    user: req.user._id,
    balanceAtAcceptance: availableBalance,
    totalPercentageApplied: 0,
    status: "active",
  });

  // Increment acceptance count on signal
  await Signal.findByIdAndUpdate(signal._id, { $inc: { acceptanceCount: 1 } });

  res.status(201).json({
    message: "Trade accepted successfully",
    balanceAtAcceptance: availableBalance,
    acceptance,
  });
});

// @desc    Get all users who accepted a signal (admin)
// @route   GET /api/vip/signals/:id/acceptances
// @access  Private/Admin
const getSignalAcceptances = asyncHandler(async (req, res) => {
  const acceptances = await TradeAcceptance.find({ signal: req.params.id })
    .populate("user", "name email phone profile")
    .sort({ createdAt: -1 });

  res.status(200).json(acceptances);
});

// ─── SIGNAL OUTCOME (PROFIT / LOSS) ──────────────────────────────────────────

// @desc    Mark a TP or SL outcome — adjusts all accepting users' balances
// @route   POST /api/vip/signals/:id/outcome
// @access  Private/Admin
// In vipController.js - markSignalOutcome function

const markSignalOutcome = asyncHandler(async (req, res) => {
  const { label, outcomeType } = req.body;

  if (!label || !outcomeType) {
    res.status(400);
    throw new Error("label and outcomeType are required");
  }

  if (!["profit", "loss"].includes(outcomeType)) {
    res.status(400);
    throw new Error("outcomeType must be profit or loss");
  }

  const signal = await Signal.findById(req.params.id);

  if (!signal) {
    res.status(404);
    throw new Error("Signal not found");
  }

  if (["completed", "closed", "cancelled"].includes(signal.status)) {
    res.status(400);
    throw new Error(`This signal is already ${signal.status}`);
  }

  let level;
  let isStopLoss = false;

  level = signal.takeProfits.find(
    (l) => l.label.toLowerCase() === label.toLowerCase()
  );

  if (!level) {
    level = signal.stopLosses.find(
      (l) => l.label.toLowerCase() === label.toLowerCase()
    );
    isStopLoss = true;
  }

  if (!level) {
    res.status(404);
    throw new Error(`No level with label "${label}" found on this signal`);
  }

  if (isStopLoss && outcomeType !== "loss") {
    res.status(400);
    throw new Error("Stop loss can only be marked as LOSS");
  }

  if (!isStopLoss && outcomeType !== "profit") {
    res.status(400);
    throw new Error("Take profit can only be marked as PROFIT");
  }

  const existingOutcome = await SignalOutcome.findOne({
    signal: signal._id,
    label: level.label,
    outcomeType,
  });

  if (existingOutcome) {
    res.status(400);
    throw new Error(`Level "${label}" has already been marked as ${outcomeType}`);
  }

  const signedPercentage =
    outcomeType === "profit"
      ? Math.abs(level.percentage)
      : -Math.abs(level.percentage);

  const acceptances = await TradeAcceptance.find({
    signal: signal._id,
    status: "active",
  }).populate("user", "name email");

  const txDocs = [];
  const bulkOps = [];

  for (const acceptance of acceptances) {
    const adjustmentAmount = Number(
      ((Math.abs(signedPercentage) / 100) * acceptance.balanceAtAcceptance).toFixed(2)
    );

    if (adjustmentAmount === 0) continue;

    const transactionId = `SIG-${signal._id}-${level.label}-${acceptance.user._id}-${Date.now()}`;

    if (outcomeType === "profit") {
      txDocs.push({
        user: acceptance.user._id,
        type: "deposit",
        amount: adjustmentAmount,
        fee: 0,
        creditedAmount: adjustmentAmount,
        asset: "USDT",
        network: "INTERNAL",
        transactionId,
        paymentMethod: "signal",
        status: "approved",
        note: `Signal profit: ${signal.pair} ${level.label} (+${level.percentage}%)`,
        description: `Profit from ${signal.pair} signal - ${level.label}`,
      });

      await User.findByIdAndUpdate(acceptance.user._id, {
        $inc: { balance: adjustmentAmount },
      });
    } else {
      txDocs.push({
        user: acceptance.user._id,
        type: "withdrawal",
        amount: adjustmentAmount,
        fee: 0,
        creditedAmount: adjustmentAmount,
        asset: "USDT",
        network: "INTERNAL",
        transactionId,
        paymentMethod: "signal",
        status: "approved",
        note: `Signal loss: ${signal.pair} ${level.label} (-${level.percentage}%)`,
        description: `Loss from ${signal.pair} signal - ${level.label}`,
      });

      await User.findByIdAndUpdate(acceptance.user._id, {
        $inc: { balance: -adjustmentAmount },
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: acceptance._id },
        update: { $inc: { totalPercentageApplied: signedPercentage } },
      },
    });
  }

  if (txDocs.length > 0) {
    await Transaction.insertMany(txDocs);
  }

  if (bulkOps.length > 0) {
    await TradeAcceptance.bulkWrite(bulkOps);
  }

  const outcome = await SignalOutcome.create({
    signal: signal._id,
    label: level.label,
    percentage: signedPercentage,
    outcomeType,
    markedBy: req.admin?._id || null,
    affectedUsers: acceptances.length,
  });

  let signalCompleted = false;
  let signalClosed = false;

  if (isStopLoss) {
    signal.status = "completed";
    signalClosed = false;
    signalCompleted = true;
    await signal.save();
  } else {
    const allProfitOutcomes = await SignalOutcome.find({
      signal: signal._id,
      outcomeType: "profit",
    });

    const hitLabels = new Set(allProfitOutcomes.map((o) => o.label));
    const allTpsHit =
      signal.takeProfits.length > 0 &&
      signal.takeProfits.every((tp) => hitLabels.has(tp.label));

    if (allTpsHit) {
      signal.status = "completed";
      signalCompleted = true;
      await signal.save();
    }
  }

  res.status(200).json({
    message: `${outcomeType === "profit" ? "Profit" : "Loss"} applied successfully${
      signalCompleted ? " and signal completed." : ""
    }`,
    label: level.label,
    percentage: signedPercentage,
    affectedUsers: acceptances.length,
    signalCompleted,
    signalClosed,
    outcome,
  });
});

// @desc    Get all outcome history for a signal (admin)
// @route   GET /api/vip/signals/:id/outcomes
// @access  Private/Admin
const getSignalOutcomes = asyncHandler(async (req, res) => {
  const outcomes = await SignalOutcome.find({ signal: req.params.id }).sort({
    createdAt: -1,
  });
  res.status(200).json(outcomes);
});

export {
  // VIP payments
  vipPayment,
  updateVipPaymentStatus,
  getMyVipStatus,
  getMyVipPayments,
  getAllVipPayments,
  // Signals
  uploadSignal,
  getSignals,
  getSignalById,
  updateSignal,
  deleteSignal,
  // Trade acceptance
  acceptSignal,
  getSignalAcceptances,
  // Outcomes
  markSignalOutcome,
  getSignalOutcomes,
};