import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["company", "distributor", "retail", "end_user"];
export const USER_STATUS = ["pending", "approved", "rejected", "suspended", "blocked"];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    name: { type: String, trim: true },
    businessName: { type: String, trim: true },
    address: { type: String, trim: true },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    /** True only for the single Hornvin `company` root (same account as Super Admin). */
    isPlatformOwner: { type: Boolean, default: false },
    /** Controlled onboarding + Super Admin moderation. */
    status: { type: String, enum: USER_STATUS, default: "pending" },
    /** Super Admin can toggle capabilities per user. */
    permissions: {
      canAddProducts: { type: Boolean, default: true },
      canPlaceOrders: { type: Boolean, default: true },
      canSell: { type: Boolean, default: true },
    },
    /** Set when distributor/admin sets initial password — user must change on first login. */
    mustChangePassword: { type: Boolean, default: false },
    /** Self-serve `end_user` with email: false until `register_email_verify` OTP succeeds (`server/src/routes/auth.js`). */
    emailVerified: { type: Boolean, default: true },
    /**
     * Hierarchy / audit: Super Admin or distributor who created this account (null for self-registration).
     * Use with `companyId` / `distributorId` to explain the full tree.
     */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ createdBy: 1 });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Product language: `approved` in DB = active account (can use app when not blocked by mustChangePassword). */
export function lifecycleStatusFrom(status) {
  const s = status == null || status === "" ? "approved" : status;
  if (s === "approved") return "active";
  return s;
}

/**
 * Non-approved account states for auth / JWT middleware.
 * Returns `{ code, error }` to return as 403, or `null` if the account may proceed (subject to `mustChangePassword`, etc.).
 */
export function getAccountAccessDenial(userDoc) {
  const s = userDoc?.status;
  if (s == null || s === "") return null;
  if (s === "approved") return null;
  if (s === "blocked") return { code: "ACCOUNT_BLOCKED", error: "Account blocked" };
  if (s === "suspended") return { code: "ACCOUNT_SUSPENDED", error: "Account suspended" };
  if (s === "rejected") return { code: "ACCOUNT_REJECTED", error: "Registration was rejected" };
  if (s === "pending") return { code: "ACCOUNT_PENDING", error: "Account pending approval" };
  return { code: "ACCOUNT_PENDING", error: "Account pending approval" };
}

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this.id,
    email: this.email,
    phone: this.phone,
    role: this.role,
    name: this.name,
    businessName: this.businessName,
    address: this.address,
    location: this.location,
    companyId: this.companyId,
    distributorId: this.distributorId,
    isPlatformOwner: !!this.isPlatformOwner,
    status: this.status || "approved",
    lifecycleStatus: lifecycleStatusFrom(this.status),
    permissions: this.permissions
      ? {
          canAddProducts: this.permissions.canAddProducts !== false,
          canPlaceOrders: this.permissions.canPlaceOrders !== false,
          canSell: this.permissions.canSell !== false,
        }
      : {
          canAddProducts: true,
          canPlaceOrders: true,
          canSell: true,
        },
    mustChangePassword: !!this.mustChangePassword,
    emailVerified: this.emailVerified !== false,
    createdBy: this.createdBy ? String(this.createdBy) : undefined,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
export const USER_ROLES = ROLES;

/** Legacy documents without `status` are treated as approved everywhere. */
export function isUserApproved(userDoc) {
  const s = userDoc?.status;
  if (s == null || s === "") return true;
  return s === "approved";
}
