import mongoose from "mongoose";

const vipPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
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
      enum: ["crypto", "bank", "card"],
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
    vipAccessStart: {
      type: Date,
      default: null,
    },
    vipAccessExpiry: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual — checks if VIP access is currently active
vipPaymentSchema.virtual("isActive").get(function () {
  if (!this.vipAccessExpiry) return false;
  return new Date() < this.vipAccessExpiry;
});

// Virtual — days remaining
vipPaymentSchema.virtual("daysLeft").get(function () {
  if (!this.vipAccessExpiry) return 0;
  const diff = this.vipAccessExpiry - new Date();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
});

const VipPayment = mongoose.model("VipPayment", vipPaymentSchema);
export default VipPayment;