import asyncHandler from "express-async-handler";
import Transaction from "../models/transactionModel.js";

// @desc    Create a deposit request
// @route   POST /api/transactions/deposit
// @access  Private
const depositPayment = asyncHandler(async (req, res) => {
  const { amount, asset, network, transactionId, paymentMethod } = req.body;

  if (!amount || !asset || !network || !transactionId) {
    res.status(400);
    throw new Error("Amount, asset, network, and transaction ID are required");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  // Check if transactionId already exists to prevent duplicate submissions
  const existing = await Transaction.findOne({ transactionId });
  if (existing) {
    res.status(400);
    throw new Error("This transaction ID has already been submitted");
  }

  const transaction = await Transaction.create({
    user: req.user._id,
    type: "deposit",
    amount,
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

// @desc    Get logged in user's total approved deposit amount
// @route   GET /api/transactions/my/total
// @access  Private
const getMyTotalDeposit = asyncHandler(async (req, res) => {
  const result = await Transaction.aggregate([
    {
      $match: {
        user: req.user._id,
        type: "deposit",
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalDeposited: { $sum: "$amount" },
      },
    },
  ]);

  const totalDeposited = result[0]?.totalDeposited || 0;

  res.status(200).json({ totalDeposited });
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

  transaction.status = status;
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

  // Only allow owner or admin to view
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
  getAllTransactions,
  updateTransactionStatus,
  getTransactionById,
};