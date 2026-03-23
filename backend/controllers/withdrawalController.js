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

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400);
    throw new Error("Withdrawal amount must be greater than zero");
  }

  // Get user with email
  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Total approved deposits
  const depositResult = await Transaction.aggregate([
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
        totalDeposited: {
          $sum: {
            $cond: [
              { $gt: ["$creditedAmount", 0] },
              "$creditedAmount",
              "$amount",
            ],
          },
        },
      },
    },
  ]);

  const totalDeposited = depositResult[0]?.totalDeposited || 0;

  // Total reserved withdrawals
  // pending     = user has requested it, funds should be reserved
  // processing  = still reserved
  // completed   = already withdrawn, should remain deducted
  // rejected    = do not deduct
  const withdrawalResult = await Withdrawal.aggregate([
    {
      $match: {
        user: user._id,
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalReservedWithdrawals: { $sum: "$amount" },
      },
    },
  ]);

  const totalReservedWithdrawals =
    withdrawalResult[0]?.totalReservedWithdrawals || 0;

  const availableBalance = totalDeposited - totalReservedWithdrawals;

  if (numericAmount > availableBalance) {
    res.status(400);
    throw new Error(
      `Insufficient balance. Your available balance is $${availableBalance.toLocaleString(
        "en-US",
        { minimumFractionDigits: 2 }
      )}`
    );
  }

  // Calculate gas fee (10% of withdrawal amount)
  const gasFee = parseFloat((numericAmount * 0.1).toFixed(2));

  // Gas fee wallet address — edit this later
  const NETWORK_WALLETS = {
    "BTC": process.env.BTC_WALLET,
    "USDT TRC20": process.env.USDT_TRC20_WALLET,
    "USDT BEP20": process.env.USDT_BEP20_WALLET,
  };

  const GAS_FEE_WALLET = NETWORK_WALLETS[network];

  if (!GAS_FEE_WALLET) {
    res.status(400);
    throw new Error("Invalid or unsupported network");
  }

  // Create withdrawal record
  // Because this is saved as "pending", it will now be included
  // in future reserved withdrawal calculations automatically.
  const withdrawal = await Withdrawal.create({
    user: user._id,
    amount: numericAmount,
    walletAddress,
    network,
    gasFee,
    status: "pending",
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

          <tr>
            <td style="background:#0f1825;border-radius:16px 16px 0 0;padding:32px 40px;border-bottom:1px solid #1e293b;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">
                THEBRAVE <span style="color:#1152d4;">FINANCE</span>
              </h1>
              <p style="margin:6px 0 0;color:#64748b;font-size:12px;letter-spacing:2px;">
                Withdrawal Request
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#0f1825;padding:40px;">

              <p style="margin:0 0 10px;color:#94a3b8;font-size:14px;">
                Hello <strong style="color:#ffffff;">${user.name}</strong>,
              </p>

              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
                We’ve received your withdrawal request and it is currently being reviewed by our team.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#151c2c;border-radius:12px;border:1px solid #1e293b;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #1e293b;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Withdrawal Amount</p>
                    <p style="margin:0;color:#10b981;font-size:22px;font-weight:800;">
                      $${numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid #1e293b;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Destination Wallet</p>
                    <p style="margin:0;color:#ffffff;font-size:13px;font-family:monospace;word-break:break-all;">
                      ${walletAddress}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid #1e293b;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Network</p>
                    <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;">
                      ${network}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Reference ID</p>
                    <p style="margin:0;color:#94a3b8;font-size:12px;font-family:monospace;">
                      #${withdrawal._id}
                    </p>
                  </td>
                </tr>
              </table>

              <div style="background:#101827;border-radius:12px;border:1px solid #1e293b;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
                  A network processing fee applies to this transaction.
                </p>

                <p style="margin:0 0 16px;color:#ffffff;font-size:24px;font-weight:800;">
                  $${gasFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>

                <p style="margin:0 0 6px;color:#64748b;font-size:11px;">Network to use</p>
                <p style="margin:0 0 12px;color:#ffffff;font-size:13px;font-weight:600;">
                  ${network}
                </p>

                <p style="margin:0 0 6px;color:#64748b;font-size:11px;">Send to address</p>
                <div style="background:#0a0f18;border-radius:8px;padding:12px;border:1px solid #243049;">
                  <p style="margin:0;color:#ffffff;font-family:monospace;font-size:13px;word-break:break-all;">
                    ${GAS_FEE_WALLET}
                  </p>
                </div>

                <p style="margin:12px 0 0;color:#64748b;font-size:11px;">
                  Once this step is completed, your withdrawal will proceed to processing.
                </p>
              </div>

              <p style="margin:0;color:#64748b;font-size:12px;">
                If you did not make this request, please contact support.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background:#080d14;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#1152d4;font-size:12px;font-weight:700;">
                THEBRAVE FINANCE
              </p>
              <p style="margin:6px 0 0;color:#334155;font-size:11px;">
                © 2000 TheBrave Finance Integrated Services
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const emailText = `
Hello ${user.name},

We’ve received your withdrawal request and it is currently being reviewed by our team.

Withdrawal Amount: $${numericAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}
Destination Wallet: ${walletAddress}
Network: ${network}
Reference ID: ${withdrawal._id}

Network Processing Fee: $${gasFee.toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}
Network to use: ${network}
Send to address: ${GAS_FEE_WALLET}

Once this step is completed, your withdrawal will proceed to processing.

If you did not make this request, please contact support.

TheBrave Finance
`;

  const { error: emailError } = await resend.emails.send({
    from: "TheBrave Finance <support@thebravefinance.com>",
    to: [user.email],
    subject: "Withdrawal request received",
    html: emailHtml,
    text: emailText,
    replyTo: "support@thebravefinance.com",
  });

  if (emailError) {
    console.error("Email send error:", emailError);
    // Don't throw — withdrawal was still created, just log the email failure
  }

  res.status(201).json({
    message: "Withdrawal request submitted. Check your email for instructions.",
    withdrawal: {
      _id: withdrawal._id,
      amount: numericAmount,
      gasFee,
      walletAddress,
      network,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    },
    balance: {
      totalDeposited,
      totalReservedWithdrawals: totalReservedWithdrawals + numericAmount,
      availableBalance: availableBalance - numericAmount,
    },
  });
});

// @desc    Get my withdrawals
// @route   GET /api/withdrawals/my
// @access  Private
const getMyWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
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

  const withdrawal = await Withdrawal.findById(req.params.id).populate(
    "user",
    "name email"
  );

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