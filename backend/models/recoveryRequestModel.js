import mongoose from "mongoose";

const recoveryRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Recovery form details
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    lostAmount: {
      type: Number,
      required: true,
    },
    asset: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
    },
    incidentType: {
      type: String,
      required: true,
      trim: true,
    },
    incidentDate: {
      type: Date,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Payment details
    paymentNetwork: {
      type: String,
      required: true,
      trim: true,
    },
    paymentAsset: {
      type: String,
      default: "USDT",
      trim: true,
    },
    paymentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    proofOfPayment: {
      type: String,
      default: "",
    },
    submissionFee: {
      type: Number,
      required: true,
      default: 100,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminMessage: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const RecoveryRequest = mongoose.model(
  "RecoveryRequest",
  recoveryRequestSchema
);

export default RecoveryRequest;