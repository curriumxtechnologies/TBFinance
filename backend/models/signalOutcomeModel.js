import mongoose from "mongoose";

const signalOutcomeSchema = new mongoose.Schema(
  {
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true, // "TP1", "TP2", "SL1"
    },
    percentage: {
      type: Number,
      required: true, // positive = profit, negative stored as negative = loss
    },
    outcomeType: {
      type: String,
      enum: ["profit", "loss"],
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    affectedUsers: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const SignalOutcome = mongoose.model("SignalOutcome", signalOutcomeSchema);
export default SignalOutcome;