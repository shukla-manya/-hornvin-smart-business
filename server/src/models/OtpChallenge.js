import mongoose from "mongoose";

const PURPOSES = [
  "login_email_step",
  "login_phone_step",
  "login_email_otp_only",
  "password_reset",
  "register_email_verify",
];

const otpChallengeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: PURPOSES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpChallengeSchema.index({ email: 1, purpose: 1, consumed: 1 });

export const OtpChallenge = mongoose.model("OtpChallenge", otpChallengeSchema);
export const OTP_PURPOSES = PURPOSES;
