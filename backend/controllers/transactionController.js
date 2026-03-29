import asyncHandler from "express-async-handler";
import Transaction from "../models/transactionModel.js";
import Withdrawal from "../models/withdrawalModel.js";
import User from "../models/userModel.js";

// @desc    Create a deposit request
// @route   POST /api/transactions/deposit
// @access  Private
const depositPayment = asyncHandler(async (req, res) => {
  const { amount, asset, network, transactionId, paymentMethod } = req.body;

  if (!amount || !asset || !network || !transactionId) {
    res.status(400);
    throw new Error("Amount, asset, network, and transaction ID are required");
  }

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  const existing = await Transaction.findOne({ transactionId });
  if (existing) {
    res.status(400);
    throw new Error("This transaction ID has already been submitted");
  }

  const transaction = await Transaction.create({
    user: req.user._id,
    type: "deposit",
    amount: numericAmount,
    fee: 0,
    creditedAmount: 0,
    asset,
    network,
    transactionId,
    paymentMethod: paymentMethod || "crypto",
    proofOfPayment: req.file?.path || "",
    status: "pending",
  });

  res.status(201).json(transaction);
});

// @desc    Get logged in user's transactions
// @route   GET /api/transactions/my
// @access  Private
const getMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json(transactions);
});

// @desc    Get logged in user's balance summary
// @route   GET /api/transactions/my/total
// @access  Private
const getMyTotalDeposit = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const depositResult = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        status: "approved",
        type: { $in: ["deposit", "balance_adjustment"] },
      },
    },
    {
      $group: {
        _id: null,
        totalDeposited: { $sum: "$creditedAmount" },
      },
    },
  ]);

  const withdrawalResult = await Withdrawal.aggregate([
    {
      $match: {
        user: userId,
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalReservedWithdrawals: { $sum: "$amount" },
      },
    },
  ]);

  const totalDeposited = depositResult[0]?.totalDeposited || 0;
  const totalReservedWithdrawals =
    withdrawalResult[0]?.totalReservedWithdrawals || 0;

  const availableBalance = totalDeposited - totalReservedWithdrawals;

  res.status(200).json({
    totalDeposited,
    totalReservedWithdrawals,
    availableBalance,
  });
});

// @desc    Get a specific user's balance summary (admin)
// @route   GET /api/transactions/admin/user-total/:userId
// @access  Private/Admin
const getUserTotalByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const depositResult = await Transaction.aggregate([
    {
      $match: {
        user: user._id,
        status: "approved",
        type: { $in: ["deposit", "balance_adjustment"] },
      },
    },
    {
      $group: {
        _id: null,
        totalDeposited: { $sum: "$creditedAmount" },
      },
    },
  ]);

  const withdrawalResult = await Withdrawal.aggregate([
    {
      $match: {
        user: user._id,
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalReservedWithdrawals: { $sum: "$amount" },
      },
    },
  ]);

  const totalDeposited = depositResult[0]?.totalDeposited || 0;
  const totalReservedWithdrawals =
    withdrawalResult[0]?.totalReservedWithdrawals || 0;

  const availableBalance = totalDeposited - totalReservedWithdrawals;

  res.status(200).json({
    userId: user._id,
    totalDeposited,
    totalReservedWithdrawals,
    availableBalance,
  });
});

// @desc    Set a user's exact dashboard balance (admin)
// @route   POST /api/transactions/admin/set-balance/:userId
// @access  Private/Admin
const setUserBalanceByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { balance, note } = req.body;

  const desiredBalance = Number(balance);

  if (Number.isNaN(desiredBalance) || desiredBalance < 0) {
    res.status(400);
    throw new Error("Valid balance is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const depositResult = await Transaction.aggregate([
    {
      $match: {
        user: user._id,
        status: "approved",
        type: { $in: ["deposit", "balance_adjustment"] },
      },
    },
    {
      $group: {
        _id: null,
        totalDeposited: { $sum: "$creditedAmount" },
      },
    },
  ]);

  const withdrawalResult = await Withdrawal.aggregate([
    {
      $match: {
        user: user._id,
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalReservedWithdrawals: { $sum: "$amount" },
      },
    },
  ]);

  const totalDeposited = depositResult[0]?.totalDeposited || 0;
  const totalReservedWithdrawals =
    withdrawalResult[0]?.totalReservedWithdrawals || 0;

  const currentAvailableBalance = totalDeposited - totalReservedWithdrawals;
  const difference = Number((desiredBalance - currentAvailableBalance).toFixed(2));

  if (difference === 0) {
    return res.status(200).json({
      message: "Balance already matches requested value",
      availableBalance: currentAvailableBalance,
    });
  }

  if (difference > 0) {
    await Transaction.create({
      user: user._id,
      type: "balance_adjustment",
      amount: difference,
      fee: 0,
      creditedAmount: difference,
      asset: "USD",
      network: "internal",
      transactionId: `ADJ-PLUS-${Date.now()}-${user._id}`,
      paymentMethod: "admin_adjustment",
      proofOfPayment: "",
      status: "approved",
      note: note || "Admin balance increase",
      description: `Balance set by admin from ${currentAvailableBalance} to ${desiredBalance}`,
    });
  } else {
    await Withdrawal.create({
      user: user._id,
      amount: Math.abs(difference),
      walletAddress: "ADMIN-BALANCE-ADJUSTMENT",
      network: "internal",
      status: "completed",
      note: note || "Admin balance decrease",
    });
  }

  res.status(200).json({
    message: "User balance updated successfully",
    previousBalance: currentAvailableBalance,
    newBalance: desiredBalance,
    difference,
  });
});

// @desc    Get all transactions (admin)
// @route   GET /api/transactions
// @access  Private/Admin
const getAllTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({})
    .populate("user", "name email phone profile")
    .sort({ createdAt: -1 });

  res.status(200).json(transactions);
});

// @desc    Approve or reject a transaction (admin)
// @route   PUT /api/transactions/:id/status
// @access  Private/Admin
const updateTransactionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be either approved or rejected");
  }

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error("Transaction not found");
  }

  if (transaction.status !== "pending") {
    res.status(400);
    throw new Error("Only pending transactions can be updated");
  }

  if (status === "approved") {
    if (transaction.type === "balance_adjustment") {
      transaction.status = "approved";
      transaction.fee = 0;
      transaction.creditedAmount = Number(transaction.amount.toFixed(2));
    } else {
      const FEE_PERCENT = 0.05;
      const fee = transaction.amount * FEE_PERCENT;
      const creditedAmount = transaction.amount - fee;

      transaction.status = "approved";
      transaction.fee = Number(fee.toFixed(2));
      transaction.creditedAmount = Number(creditedAmount.toFixed(2));
    }
  }

  if (status === "rejected") {
    transaction.status = "rejected";
    transaction.fee = 0;
    transaction.creditedAmount = 0;
  }

  const updated = await transaction.save();

  res.status(200).json(updated);
});

// @desc    Get a single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id).populate(
    "user",
    "name email"
  );

  if (!transaction) {
    res.status(404);
    throw new Error("Transaction not found");
  }

  if (transaction.user._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("Not authorized to view this transaction");
  }

  res.status(200).json(transaction);
});

export {
  depositPayment,
  getMyTransactions,
  getMyTotalDeposit,
  getUserTotalByAdmin,
  setUserBalanceByAdmin,
  getAllTransactions,
  updateTransactionStatus,
  getTransactionById,
};