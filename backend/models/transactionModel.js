import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["deposit", "withdrawal", "balance_adjustment"],
      default: "deposit",
    },

    amount: {
      type: Number,
      required: true,
    },

    fee: {
      type: Number,
      default: 0,
    },

    creditedAmount: {
      type: Number,
      default: 0,
    },

    asset: {
      type: String,
      required: true,
      trim: true,
    },

    network: {
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

    paymentMethod: {
      type: String,
      enum: ["crypto", "bank", "card", "signal", "admin_adjustment"],
      default: "crypto",
    },

    proofOfPayment: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    note: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;