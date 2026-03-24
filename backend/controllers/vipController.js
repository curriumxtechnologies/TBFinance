import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import VipPayment from "../models/vipPaymentModel.js";
import Signal from "../models/signalModel.js";
import TradeAcceptance from "../models/tradeAcceptanceModel.js";
import SignalOutcome from "../models/signalOutcomeModel.js";
import Transaction from "../models/transactionModel.js";
import Withdrawal from "../models/withdrawalModel.js";

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
  const totalReserved  = withdrawalResult[0]?.totalReserved || 0;

  return totalDeposited - totalReserved;
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

  const now     = new Date();
  const isVip   = payment.vipAccessExpiry > now;
  const daysLeft = isVip
    ? Math.ceil((payment.vipAccessExpiry - now) / (1000 * 60 * 60 * 24))
    : 0;

  res.status(200).json({
    isVip,
    expiry:      payment.vipAccessExpiry,
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

  // takeProfits and stopLosses expected as JSON arrays:
  // [{ label: "TP1", percentage: 3.5, priceLevel: "1.2050" }, ...]
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
    pair:        pair.toUpperCase().trim(),
    type:        type.toLowerCase(),
    entry:       entry.trim(),
    takeProfits: parseLevels(takeProfits),
    stopLosses:  parseLevels(stopLosses),
    description: description || "",
    image:       req.file?.path || "",
    status:      status || "active",
    postedBy:    req.admin?._id || null,
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

  // Tell the frontend whether this user has already accepted the signal
  const acceptance = await TradeAcceptance.findOne({
    signal: signal._id,
    user:   req.user._id,
  });

  res.status(200).json({
    ...signal.toObject(),
    userAccepted:              !!acceptance,
    userAcceptanceStatus:      acceptance?.status || null,
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

  if (pair)  signal.pair  = pair.toUpperCase().trim();
  if (type)  signal.type  = type.toLowerCase();
  if (entry) signal.entry = entry.trim();

  const parsedTPs = parseLevels(takeProfits);
  const parsedSLs = parseLevels(stopLosses);

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

  if (signal.status === "closed") {
    res.status(400);
    throw new Error("This signal is closed and no longer accepting trades");
  }

  // Check if already accepted
  const existing = await TradeAcceptance.findOne({
    signal: signal._id,
    user:   req.user._id,
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
    signal:              signal._id,
    user:                req.user._id,
    balanceAtAcceptance: availableBalance,
    totalPercentageApplied: 0,
    status:              "active",
  });

  // Increment acceptance count on signal
  await Signal.findByIdAndUpdate(signal._id, { $inc: { acceptanceCount: 1 } });

  res.status(201).json({
    message:             "Trade accepted successfully",
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
//
// Body: { label: "TP1", outcomeType: "profit" | "loss" }
// The percentage is pulled from the signal's takeProfits / stopLosses array
// matching the label, so there is no way to pass an arbitrary number.
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

  // Find the matching TP or SL entry on the signal
  const allLevels = [...signal.takeProfits, ...signal.stopLosses];
  const level     = allLevels.find(
    (l) => l.label.toLowerCase() === label.toLowerCase()
  );

  if (!level) {
    res.status(404);
    throw new Error(`No level with label "${label}" found on this signal`);
  }

  // Derive the signed percentage:
  // profit → positive, loss → negative
  const signedPercentage =
    outcomeType === "profit"
      ? Math.abs(level.percentage)
      : -Math.abs(level.percentage);

  // Fetch all active acceptances for this signal
  const acceptances = await TradeAcceptance.find({
    signal: signal._id,
    status: "active",
  });

  if (acceptances.length === 0) {
    // Still record the outcome even if nobody accepted
    await SignalOutcome.create({
      signal:        signal._id,
      label:         level.label,
      percentage:    signedPercentage,
      outcomeType,
      markedBy:      req.admin?._id || null,
      affectedUsers: 0,
    });

    return res.status(200).json({
      message:       "Outcome recorded. No users had accepted this signal.",
      affectedUsers: 0,
    });
  }

  // For each accepting user, create a balance-adjustment transaction
  const bulkOps   = [];
  const txDocs    = [];

  for (const acceptance of acceptances) {
    const adjustmentAmount = Number(
      ((Math.abs(signedPercentage) / 100) * acceptance.balanceAtAcceptance).toFixed(2)
    );

    if (outcomeType === "profit") {
      // Credit: create an approved deposit-type transaction for the profit amount
      txDocs.push({
        user:            acceptance.user,
        type:            "deposit",
        amount:          adjustmentAmount,
        fee:             0,
        creditedAmount:  adjustmentAmount,
        asset:           "SIGNAL_PROFIT",
        network:         "INTERNAL",
        transactionId:   `SIG-${signal._id}-${level.label}-${acceptance.user}-${Date.now()}`,
        paymentMethod:   "signal",
        status:          "approved",
        note:            `Signal profit: ${signal.pair} ${level.label} (${level.percentage}%)`,
      });
    } else {
      // Debit: create a withdrawal-type transaction to reduce balance
      txDocs.push({
        user:            acceptance.user,
        type:            "withdrawal",
        amount:          adjustmentAmount,
        fee:             0,
        creditedAmount:  adjustmentAmount,
        asset:           "SIGNAL_LOSS",
        network:         "INTERNAL",
        transactionId:   `SIG-${signal._id}-${level.label}-${acceptance.user}-${Date.now()}`,
        paymentMethod:   "signal",
        status:          "approved",
        note:            `Signal loss: ${signal.pair} ${level.label} (${level.percentage}%)`,
      });
    }

    // Update the acceptance record
    bulkOps.push({
      updateOne: {
        filter: { _id: acceptance._id },
        update: {
          $inc: { totalPercentageApplied: signedPercentage },
        },
      },
    });
  }

  // Insert all adjustment transactions
  await Transaction.insertMany(txDocs);

  // Bulk update all acceptances
  if (bulkOps.length > 0) {
    await TradeAcceptance.bulkWrite(bulkOps);
  }

  // Log the outcome
  const outcome = await SignalOutcome.create({
    signal:        signal._id,
    label:         level.label,
    percentage:    signedPercentage,
    outcomeType,
    markedBy:      req.admin?._id || null,
    affectedUsers: acceptances.length,
  });

  res.status(200).json({
    message:       `${outcomeType === "profit" ? "Profit" : "Loss"} applied successfully`,
    label:         level.label,
    percentage:    signedPercentage,
    affectedUsers: acceptances.length,
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