import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { RETAIL_BUSINESS_TYPES_SET } from "../constants/retailProfile.js";

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
    /** Retail: landmark near shop (mandatory onboarding). */
    addressLandmark: { type: String, trim: true, default: "" },
    /** Retail: state / region label (mandatory onboarding). */
    stateRegion: { type: String, trim: true, default: "" },
    /** Retail: shop model — see `server/src/constants/retailProfile.js`. */
    businessType: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, default: "" },
    /** Data URL or https — shop front / bay photo. */
    shopPhotoUrl: { type: String, default: "" },
    /** Data URL or https — owner / contact face photo. */
    profilePhotoUrl: { type: String, default: "" },
    /** UPI VPA for receiving payments (shown as QR in app). */
    upiVpa: { type: String, trim: true, default: "" },
    /** Shown in UPI intent / QR payee name. */
    upiMerchantName: { type: String, trim: true, default: "" },
    /** Hornvin rewards balance (coupons, promos). */
    rewardPoints: { type: Number, default: 0, min: 0 },
    /** Retail garages: selected service lines (onboarding + discovery). */
    garageServices: [{ type: String, trim: true }],
    /** Distributor territory / region label (Super Admin assigns). */
    distributorRegion: { type: String, trim: true, default: "" },
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
    needsProfileSetup: computeNeedsProfileSetup(this),
    needsGarageServiceSelection: computeNeedsGarageServiceSelection(this),
    garageServices: Array.isArray(this.garageServices) ? [...this.garageServices] : [],
    createdBy: this.createdBy ? String(this.createdBy) : undefined,
    createdAt: this.createdAt,
    upiVpa: this.upiVpa || "",
    upiMerchantName: this.upiMerchantName || "",
    rewardPoints: this.rewardPoints ?? 0,
    distributorRegion: this.distributorRegion || "",
    addressLandmark: this.addressLandmark || "",
    stateRegion: this.stateRegion || "",
    businessType: this.businessType || "",
    gstNumber: this.gstNumber || "",
    shopPhotoUrl: this.shopPhotoUrl || "",
    profilePhotoUrl: this.profilePhotoUrl || "",
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

function retailPhotoOk(s) {
  const t = typeof s === "string" ? s.trim() : "";
  if (t.length < 24) return false;
  return t.startsWith("data:image/") || t.startsWith("https://") || t.startsWith("http://");
}

/** First-login / empty-name accounts must finish profile in the app before full access. */
export function computeNeedsProfileSetup(userDoc) {
  const n = userDoc?.name;
  if (!(n && String(n).trim())) return true;
  if (userDoc?.role === "retail") {
    const b = userDoc?.businessName;
    if (!(b && String(b).trim())) return true;
    const addr = userDoc?.address;
    if (!(addr && String(addr).trim())) return true;
    const lm = userDoc?.addressLandmark;
    if (!(lm && String(lm).trim())) return true;
    const st = userDoc?.stateRegion;
    if (!(st && String(st).trim())) return true;
    const bt = userDoc?.businessType;
    if (!bt || !RETAIL_BUSINESS_TYPES_SET.has(String(bt))) return true;
    if (!retailPhotoOk(userDoc?.shopPhotoUrl) || !retailPhotoOk(userDoc?.profilePhotoUrl)) return true;
  }
  return false;
}

/** Approved retail garages pick at least one service after profile (`GarageServiceSelection` screen). */
export function computeNeedsGarageServiceSelection(userDoc) {
  if (userDoc?.role !== "retail") return false;
  if (computeNeedsProfileSetup(userDoc)) return false;
  const st = userDoc?.status;
  if (st != null && st !== "" && st !== "approved") return false;
  const arr = userDoc.garageServices;
  return !Array.isArray(arr) || arr.length === 0;
}
