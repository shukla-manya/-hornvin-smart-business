import bcrypt from "bcryptjs";
import { OtpChallenge } from "../models/OtpChallenge.js";
import { sendMail } from "../config/mail.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const lastOtpRequest = new Map();

/** Returns false if this key was used within cooldownMs (anti-spam). */
export function allowOtpRequest(key, cooldownMs = 45000) {
  const now = Date.now();
  const prev = lastOtpRequest.get(key) || 0;
  if (now - prev < cooldownMs) return false;
  lastOtpRequest.set(key, now);
  return true;
}

function randomSixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndEmailOtp(email, purpose) {
  const code = randomSixDigit();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await OtpChallenge.updateMany({ email, purpose, consumed: false }, { $set: { consumed: true } });

  await OtpChallenge.create({
    email,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    consumed: false,
  });

  const transporterConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const subject =
    purpose === "login_email_step"
      ? "Your Vello sign-in code"
      : purpose === "register_email_verify"
        ? "Verify your Vello email"
        : purpose === "login_email_otp_only"
          ? "Your Vello sign-in code"
          : "Your Vello password reset code";
  const bodyText = `Your verification code is ${code}. It expires in 10 minutes. Do not share this code.`;

  if (!transporterConfigured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery not configured (set SMTP_USER / SMTP_PASS for Gmail)");
    }
    console.info(`[OTP dev] ${email} (${purpose}): ${code}`);
    return { devCode: code };
  }

  await sendMail({
    to: email,
    subject,
    text: bodyText,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  return {};
}

export async function verifyOtpCode(email, purpose, plainCode) {
  const row = await OtpChallenge.findOne({
    email,
    purpose,
    consumed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!row) return { ok: false, error: "No active code. Request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) {
    await row.deleteOne();
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const match = await bcrypt.compare(String(plainCode).trim(), row.codeHash);
  if (!match) {
    row.attempts += 1;
    await row.save();
    return { ok: false, error: "Invalid code" };
  }

  row.consumed = true;
  await row.save();
  return { ok: true };
}
