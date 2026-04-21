import mongoose from "mongoose";

const couponRedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    pointsAwarded: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ userId: 1, couponId: 1 }, { unique: true });

export const CouponRedemption = mongoose.model("CouponRedemption", couponRedemptionSchema);
