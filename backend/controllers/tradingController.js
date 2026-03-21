import asyncHandler from "express-async-handler";
import TradingAccount from "../models/tradingAccountModel.js";
import Transaction from "../models/transactionModel.js";

// @desc    Assign demo account to user (admin)
// @route   POST /api/trading/demo/:userId
// @access  Private/Admin
const assignDemoAccount = asyncHandler(async (req, res) => {
  const { loginId, server, balance } = req.body;
  const { userId } = req.params;

  if (!loginId || !server || !balance) {
    res.status(400);
    throw new Error("Login ID, server, and balance are required");
  }

  // One demo account per user
  const existing = await TradingAccount.findOne({
    user: userId,
    type: "demo",
  });

  if (existing) {
    res.status(400);
    throw new Error("User already has a demo account");
  }

  const account = await TradingAccount.create({
    user: userId,
    type: "demo",
    loginId,
    server,
    balance,
    status: "active",
  });

  res.status(201).json(account);
});

// @desc    Assign live account to user (admin) — only if they have an approved deposit
// @route   POST /api/trading/live/:userId
// @access  Private/Admin
const assignLiveAccount = asyncHandler(async (req, res) => {
  const { loginId, server } = req.body;
  const { userId } = req.params;

  if (!loginId || !server) {
    res.status(400);
    throw new Error("Login ID and server are required");
  }

  // Check user has at least one approved deposit
  const approvedDeposit = await Transaction.findOne({
    user: userId,
    type: "deposit",
    status: "approved",
  });

  if (!approvedDeposit) {
    res.status(400);
    throw new Error("User has no approved deposits. Cannot assign live account.");
  }

  // One live account per user
  const existing = await TradingAccount.findOne({
    user: userId,
    type: "live",
  });

  if (existing) {
    res.status(400);
    throw new Error("User already has a live account");
  }

  // Get total approved deposit amount for balance
  const result = await Transaction.aggregate([
    {
      $match: {
        user: approvedDeposit.user,
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

  const balance = result[0]?.totalDeposited || 0;

  const account = await TradingAccount.create({
    user: userId,
    type: "live",
    loginId,
    server,
    balance,
    status: "active",
  });

  res.status(201).json(account);
});

// @desc    Update trading account balance (admin) — e.g. after new deposit approved
// @route   PUT /api/trading/:accountId/balance
// @access  Private/Admin
const updateAccountBalance = asyncHandler(async (req, res) => {
  const { balance } = req.body;

  if (balance === undefined || balance < 0) {
    res.status(400);
    throw new Error("Valid balance is required");
  }

  const account = await TradingAccount.findById(req.params.accountId);

  if (!account) {
    res.status(404);
    throw new Error("Trading account not found");
  }

  account.balance = balance;
  const updated = await account.save();

  res.status(200).json(updated);
});

// @desc    Update trading account details (admin)
// @route   PUT /api/trading/:accountId
// @access  Private/Admin
const updateAccount = asyncHandler(async (req, res) => {
  const { loginId, server, status } = req.body;

  const account = await TradingAccount.findById(req.params.accountId);

  if (!account) {
    res.status(404);
    throw new Error("Trading account not found");
  }

  if (loginId) account.loginId = loginId;
  if (server) account.server = server;
  if (status) account.status = status;

  const updated = await account.save();

  res.status(200).json(updated);
});

// @desc    Get logged in user's trading accounts
// @route   GET /api/trading/my
// @access  Private
const getMyAccounts = asyncHandler(async (req, res) => {
  const accounts = await TradingAccount.find({ user: req.user._id });

  const demo = accounts.find((a) => a.type === "demo") || null;
  const live = accounts.find((a) => a.type === "live") || null;

  res.status(200).json({ demo, live });
});

// @desc    Get all trading accounts (admin)
// @route   GET /api/trading
// @access  Private/Admin
const getAllAccounts = asyncHandler(async (req, res) => {
  const accounts = await TradingAccount.find({})
    .populate("user", "name email phone profile")
    .sort({ createdAt: -1 });

  res.status(200).json(accounts);
});

// @desc    Get all users with approved deposits but no live account (admin)
// @route   GET /api/trading/eligible-for-live
// @access  Private/Admin
const getUsersEligibleForLive = asyncHandler(async (req, res) => {
  // Find users with at least one approved deposit
  const approvedDeposits = await Transaction.distinct("user", {
    type: "deposit",
    status: "approved",
  });

  // Find users who already have a live account
  const existingLive = await TradingAccount.distinct("user", {
    type: "live",
  });

  // Filter out users who already have a live account
  const existingLiveStr = existingLive.map((id) => id.toString());
  const eligible = approvedDeposits.filter(
    (userId) => !existingLiveStr.includes(userId.toString())
  );

  // Populate user details
  const User = (await import("../models/userModel.js")).default;
  const users = await User.find({ _id: { $in: eligible } }).select(
    "name email phone profile"
  );

  res.status(200).json(users);
});

// @desc    Delete a trading account (admin)
// @route   DELETE /api/trading/:accountId
// @access  Private/Admin
const deleteAccount = asyncHandler(async (req, res) => {
  const account = await TradingAccount.findById(req.params.accountId);

  if (!account) {
    res.status(404);
    throw new Error("Trading account not found");
  }

  await account.deleteOne();

  res.status(200).json({ message: "Trading account removed" });
});

export {
  assignDemoAccount,
  assignLiveAccount,
  updateAccountBalance,
  updateAccount,
  getMyAccounts,
  getAllAccounts,
  getUsersEligibleForLive,
  deleteAccount,
};