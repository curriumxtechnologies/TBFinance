import mongoose from "mongoose";

const tpSlSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // "TP1", "TP2", "SL1"
    percentage: { type: Number, required: true }, // 3.5 means 3.5%
    priceLevel: { type: String, trim: true, default: "" }, // optional price string
  },
  { _id: false },
);

const signalSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, trim: true },
    type: { type: String, enum: ["buy", "sell"], required: true },
    entry: { type: String, required: true, trim: true },

    takeProfits: [tpSlSchema],
    stopLosses: [tpSlSchema],

    description: { type: String, default: "" },
    image: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "completed", "closed", "cancelled"],
      default: "active",
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    acceptanceCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Signal = mongoose.model("Signal", signalSchema);
export default Signal;
