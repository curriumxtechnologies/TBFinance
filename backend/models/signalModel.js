import mongoose from "mongoose";

const signalSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, trim: true },
    type: { type: String, enum: ["buy", "sell"], required: true },
    entry: { type: String, required: true },
    takeProfits: [{ type: String }],
    stopLosses: [{ type: String }],
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "closed", "cancelled"],
      default: "active",
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

const Signal = mongoose.model("Signal", signalSchema);
export default Signal;