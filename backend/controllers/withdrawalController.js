import asyncHandler from "express-async-handler";
import { Resend } from "resend";
import Withdrawal from "../models/withdrawalModel.js";
import Transaction from "../models/transactionModel.js";
import User from "../models/userModel.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// @desc    Submit a withdrawal request
// @route   POST /api/withdrawals
// @access  Private
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, walletAddress, network } = req.body;

  if (!amount || !walletAddress || !network) {
    res.status(400);
    throw new Error("Amount, wallet address, and network are required");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Withdrawal amount must be greater than zero");
  }

  // Get user with email
  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check user has enough approved deposits
  const result = await Transaction.aggregate([
    {
      $match: {
        user: user._id,
        type: "deposit",
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalDeposited: { $sum: "$amount" },
      },
    },
  ]);

  const totalDeposited = result[0]?.totalDeposited || 0;

  if (amount > totalDeposited) {
    res.status(400);
    throw new Error(
      `Insufficient balance. Your approved deposit balance is $${totalDeposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  }

  // Calculate gas fee (10% of withdrawal amount)
  const gasFee = parseFloat((amount * 0.1).toFixed(2));

  // Gas fee wallet address — edit this later
  const GAS_FEE_WALLET = "WALLET_ADDRESS_HERE";

  // Create withdrawal record
  const withdrawal = await Withdrawal.create({
    user:          user._id,
    amount,
    walletAddress,
    network,
    gasFee,
    status:        "pending",
  });

  // Send email via Resend
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Withdrawal Request — TheBrave Finance</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0f18;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f18;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:#0f1825;border-radius:16px 16px 0 0;padding:32px 40px;border-bottom:1px solid #1e293b;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                    THEBRAVE <span style="color:#1152d4;">FINANCE</span>
                  </h1>
                  <p style="margin:6px 0 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Withdrawal Notice</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#0f1825;padding:40px;">

                  <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Hi <strong style="color:#ffffff;">${user.name}</strong>,</p>
                  <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                    Your withdrawal request has been received and is currently being reviewed. To proceed with your withdrawal, a <strong style="color:#ffffff;">gas fee payment</strong> is required to cover network processing costs.
                  </p>

                  <!-- Status Banner -->
                  <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:16px 20px;margin-bottom:32px;text-align:center;">
                    <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">⏳ Awaiting Gas Fee Payment</p>
                  </div>

                  <!-- Withdrawal Details -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#151c2c;border-radius:12px;border:1px solid #1e293b;margin-bottom:24px;overflow:hidden;">
                    <tr>
                      <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Withdrawal Amount</p>
                        <p style="margin:0;color:#10b981;font-size:24px;font-weight:800;">$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;border-bottom:1px solid #1e293b;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Destination Wallet</p>
                        <p style="margin:0;color:#ffffff;font-size:13px;font-family:monospace;word-break:break-all;">${walletAddress}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;border-bottom:1px solid #1e293b;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Network</p>
                        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;">${network}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 24px;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Reference ID</p>
                        <p style="margin:0;color:#94a3b8;font-size:12px;font-family:monospace;">#${withdrawal._id}</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Gas Fee Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(17,82,212,0.08);border-radius:12px;border:1px solid rgba(17,82,212,0.3);margin-bottom:32px;">
                    <tr>
                      <td style="padding:24px;">
                        <p style="margin:0 0 16px;color:#6090ff;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">⛽ Gas Fee Required</p>
                        <p style="margin:0 0 6px;color:#94a3b8;font-size:13px;line-height:1.6;">
                          To release your funds, please send the network gas fee of:
                        </p>
                        <p style="margin:8px 0 16px;color:#ffffff;font-size:28px;font-weight:900;">
                          $${gasFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          <span style="font-size:13px;color:#64748b;font-weight:400;">&nbsp;(10% of withdrawal)</span>
                        </p>
                        <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Send gas fee to:</p>
                        <div style="background:#0a0f18;border-radius:8px;padding:12px 16px;border:1px solid #243049;">
                          <p style="margin:0;color:#ffffff;font-family:monospace;font-size:13px;word-break:break-all;">${GAS_FEE_WALLET}</p>
                        </div>
                        <p style="margin:12px 0 0;color:#64748b;font-size:11px;line-height:1.5;">
                          ⚠️ Gas fee payment must be made within <strong style="color:#fbbf24;">24 hours</strong> to keep your withdrawal request active. Once confirmed, your funds will be processed within 1–3 business days.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
                    If you did not initiate this withdrawal request, please contact our support team immediately.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#080d14;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
                  <p style="margin:0 0 4px;color:#1152d4;font-size:12px;font-weight:700;">THEBRAVE FINANCE</p>
                  <p style="margin:0;color:#334155;font-size:11px;">© 2025 TheBrave Finance Integrated Services. All rights reserved.</p>
                  <p style="margin:8px 0 0;color:#334155;font-size:10px;">This is an automated message. Please do not reply to this email.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const { error: emailError } = await resend.emails.send({
    from:    "TheBrave Finance <noreply@thebravefinance.com>",
    to:      [user.email],
    subject: `Withdrawal Request — Gas Fee Required ($${gasFee.toLocaleString("en-US", { minimumFractionDigits: 2 })})`,
    html:    emailHtml,
  });

  if (emailError) {
    console.error("Email send error:", emailError);
    // Don't throw — withdrawal was still created, just log the email failure
  }

  res.status(201).json({
    message:    "Withdrawal request submitted. Check your email for instructions.",
    withdrawal: {
      _id:           withdrawal._id,
      amount,
      gasFee,
      walletAddress,
      network,
      status:        withdrawal.status,
      createdAt:     withdrawal.createdAt,
    },
  });
});

// @desc    Get my withdrawals
// @route   GET /api/withdrawals/my
// @access  Private
const getMyWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id })
    .sort({ createdAt: -1 });
  res.status(200).json(withdrawals);
});

// @desc    Get all withdrawals (admin)
// @route   GET /api/withdrawals
// @access  Private/Admin
const getAllWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 });
  res.status(200).json(withdrawals);
});

// @desc    Update withdrawal status (admin)
// @route   PUT /api/withdrawals/:id/status
// @access  Private/Admin
const updateWithdrawalStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["pending", "processing", "completed", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const withdrawal = await Withdrawal.findById(req.params.id).populate("user", "name email");

  if (!withdrawal) {
    res.status(404);
    throw new Error("Withdrawal not found");
  }

  withdrawal.status = status;
  const updated = await withdrawal.save();

  res.status(200).json(updated);
});

export {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  updateWithdrawalStatus,
};