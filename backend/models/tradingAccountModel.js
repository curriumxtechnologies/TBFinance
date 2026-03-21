import mongoose from "mongoose";

const tradingAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["demo", "live"],
      required: true,
    },
    loginId: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
    },
  },
  { timestamps: true }
);

// One demo and one live per user
tradingAccountSchema.index({ user: 1, type: 1 }, { unique: true });

const TradingAccount = mongoose.model("TradingAccount", tradingAccountSchema);
export default TradingAccount;