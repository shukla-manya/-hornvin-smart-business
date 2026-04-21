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

/** Stable key for phone OTP rows (stored in OtpChallenge.email field for legacy schema shape). */
export function phoneOtpStorageKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `phone:${digits}`;
}

function shouldLogOtpToTerminal() {
  return process.env.NODE_ENV !== "production" || process.env.OTP_LOG_TO_CONSOLE === "1";
}

export function logOtpToTerminal(channel, destination, purpose, code) {
  if (!shouldLogOtpToTerminal()) return;
  console.info(`[OTP] ${purpose} · ${channel} → ${destination} · code=${code}`);
}

async function persistOtpChallenge(identifier, purpose, code) {
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await OtpChallenge.updateMany({ email: identifier, purpose, consumed: false }, { $set: { consumed: true } });
  await OtpChallenge.create({
    email: identifier,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    consumed: false,
  });
}

export async function createAndEmailOtp(email, purpose) {
  const code = randomSixDigit();
  await persistOtpChallenge(email, purpose, code);

  const transporterConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const subject =
    purpose === "login_email_step"
      ? "Your Hornvin sign-in code"
      : purpose === "register_email_verify"
        ? "Verify your Hornvin email"
        : purpose === "login_email_otp_only"
          ? "Your Hornvin sign-in code"
          : "Your Hornvin password reset code";
  const bodyText = `Your verification code is ${code}. It expires in 10 minutes. Do not share this code.`;

  if (!transporterConfigured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery not configured (set SMTP_USER / SMTP_PASS for Gmail)");
    }
    logOtpToTerminal("email", email, purpose, code);
    return { devCode: code };
  }

  await sendMail({
    to: email,
    subject,
    text: bodyText,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  logOtpToTerminal("email", email, purpose, code);
  return {};
}

/**
 * Phone login step: no SMS integration yet — code is always printed on the API terminal (and devCode in tests).
 * Stored under `phone:<digits>` in the OtpChallenge `email` field.
 */
export async function createPhoneLoginOtp(plainPhone, purpose = "login_phone_step") {
  const key = phoneOtpStorageKey(plainPhone);
  if (!key) throw new Error("Invalid phone for OTP");
  const code = randomSixDigit();
  await persistOtpChallenge(key, purpose, code);
  logOtpToTerminal("phone", plainPhone, purpose, code);
  if (process.env.NODE_ENV === "test") return { devCode: code };
  return {};
}

/** `identifier` is either a real email or `phone:<digits>` from phoneOtpStorageKey(). */
export async function verifyOtpCode(identifier, purpose, plainCode) {
  const row = await OtpChallenge.findOne({
    email: identifier,
    purpose,
    consumed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!row) return { ok: false, error: "No active code. Request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) {
    await row.deleteOne();
    return { ok: false, error: "Too many attempts. Request a new one." };
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
