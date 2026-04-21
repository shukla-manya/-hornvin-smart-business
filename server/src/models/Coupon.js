import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    title: { type: String, trim: true, default: "" },
    pointsValue: { type: Number, default: 0, min: 0 },
    /** Informational — future checkout integration. */
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    maxUses: { type: Number, default: 1000, min: 1 },
    usesCount: { type: Number, default: 0, min: 0 },
    validUntil: { type: Date },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

couponSchema.index({ active: 1, validUntil: 1 });

export const Coupon = mongoose.model("Coupon", couponSchema);
