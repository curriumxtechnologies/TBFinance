import asyncHandler from "express-async-handler";
import RecoveryRequest from "../models/recoveryRequestModel.js";

// @desc    Create recovery request
// @route   POST /api/recovery-requests
// @access  Private
const createRecoveryRequest = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    lostAmount,
    asset,
    platform,
    incidentType,
    incidentDate,
    description,
    paymentNetwork,
    paymentAsset,
    paymentAddress,
    transactionId,
    submissionFee,
  } = req.body;

  if (
    !fullName ||
    !email ||
    !lostAmount ||
    !asset ||
    !platform ||
    !incidentType ||
    !description ||
    !paymentNetwork ||
    !paymentAddress ||
    !transactionId
  ) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }

  const numericLostAmount = Number(lostAmount);
  const numericSubmissionFee = Number(submissionFee || 100);

  if (Number.isNaN(numericLostAmount) || numericLostAmount <= 0) {
    res.status(400);
    throw new Error("Lost amount must be greater than 0");
  }

  if (Number.isNaN(numericSubmissionFee) || numericSubmissionFee <= 0) {
    res.status(400);
    throw new Error("Submission fee must be greater than 0");
  }

  const existing = await RecoveryRequest.findOne({ transactionId });
  if (existing) {
    res.status(400);
    throw new Error("This payment transaction ID has already been used");
  }

  const recoveryRequest = await RecoveryRequest.create({
    user: req.user._id,
    fullName,
    email,
    lostAmount: numericLostAmount,
    asset,
    platform,
    incidentType,
    incidentDate: incidentDate || null,
    description,
    paymentNetwork,
    paymentAsset: paymentAsset || "USDT",
    paymentAddress,
    transactionId,
    proofOfPayment: req.file?.path || "",
    submissionFee: numericSubmissionFee,
    status: "pending",
    adminMessage: "",
  });

  res.status(201).json(recoveryRequest);
});

// @desc    Get logged in user's recovery requests
// @route   GET /api/recovery-requests/my
// @access  Private
const getMyRecoveryRequests = asyncHandler(async (req, res) => {
  const requests = await RecoveryRequest.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json(requests);
});

// @desc    Get all recovery requests
// @route   GET /api/recovery-requests
// @access  Private/Admin
const getAllRecoveryRequests = asyncHandler(async (req, res) => {
  const requests = await RecoveryRequest.find({})
    .populate("user", "name email phone profile")
    .sort({ createdAt: -1 });

  res.status(200).json(requests);
});

// @desc    Update recovery request status
// @route   PUT /api/recovery-requests/:id/status
// @access  Private/Admin
const updateRecoveryRequestStatus = asyncHandler(async (req, res) => {
  const { status, adminMessage } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be approved or rejected");
  }

  const request = await RecoveryRequest.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error("Recovery request not found");
  }

  request.status = status;

  if (status === "approved") {
    request.adminMessage =
      adminMessage?.trim() || "Recovery team is on your case";
  }

  if (status === "rejected") {
    request.adminMessage =
      adminMessage?.trim() || "Your recovery request was not approved";
  }

  const updated = await request.save();
  res.status(200).json(updated);
});

export {
  createRecoveryRequest,
  getMyRecoveryRequests,
  getAllRecoveryRequests,
  updateRecoveryRequestStatus,
};