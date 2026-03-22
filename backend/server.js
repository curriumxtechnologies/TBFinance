import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import userRoutes from './routes/userRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js';
import tradingRoutes from './routes/tradingRoutes.js';
import vipRoutes from './routes/vipRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import withdrawalRoutes from './routes/withdrawalRoutes.js'
import recoveryRequestRoutes from "./routes/recoveryRequestRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL;

const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://thebravefinance.vercel.app',
  'https://www.thebravefinance.com',
  'https://thebravefinance.com'
];

// ✅ CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is reachable" });
});

// ✅ Routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/vip', vipRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/recovery-requests', recoveryRequestRoutes);

// ✅ Error handlers
app.use(notFound);
app.use(errorHandler);

// ✅ Mongo + server start
mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error("❌ Mongo error:", err.message));