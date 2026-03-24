import mongoose from "mongoose";

const tradeAcceptanceSchema = new mongoose.Schema(
  {
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Snapshot of available balance when the user accepted
    balanceAtAcceptance: {
      type: Number,
      required: true,
    },
    // Total % change applied to this user from all TP/SL markings on this signal
    totalPercentageApplied: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// A user can only accept a signal once
tradeAcceptanceSchema.index({ signal: 1, user: 1 }, { unique: true });

const TradeAcceptance = mongoose.model("TradeAcceptance", tradeAcceptanceSchema);
export default TradeAcceptance;