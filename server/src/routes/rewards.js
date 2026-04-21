import { Router } from "express";
import { body, validationResult } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Coupon } from "../models/Coupon.js";
import { CouponRedemption } from "../models/CouponRedemption.js";

export const rewardsRouter = Router();
rewardsRouter.use(requireAuth(true));

rewardsRouter.get("/me", async (req, res) => {
  const user = await User.findById(req.user._id).select("rewardPoints upiVpa upiMerchantName").lean();
  const history = await CouponRedemption.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate("couponId", "code title pointsValue discountPercent")
    .lean();
  return res.json({
    rewardPoints: user?.rewardPoints ?? 0,
    upiVpa: user?.upiVpa || "",
    history,
  });
});

rewardsRouter.post(
  "/redeem",
  [body("code").isString().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const code = String(req.body.code).trim().toUpperCase().slice(0, 40);
    const coupon = await Coupon.findOne({ code });
    if (!coupon || !coupon.active) {
      return res.status(400).json({ error: "Invalid or inactive coupon code.", code: "COUPON_INVALID" });
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return res.status(400).json({ error: "This coupon has expired.", code: "COUPON_EXPIRED" });
    }
    if (coupon.usesCount >= coupon.maxUses) {
      return res.status(400).json({ error: "This coupon has reached its redemption limit.", code: "COUPON_EXHAUSTED" });
    }

    const pointsAwarded = coupon.pointsValue || 0;
    try {
      await CouponRedemption.create({
        userId: req.user._id,
        couponId: coupon._id,
        pointsAwarded,
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: "You have already redeemed this coupon.", code: "COUPON_ALREADY_USED" });
      }
      throw e;
    }

    await User.updateOne({ _id: req.user._id }, { $inc: { rewardPoints: pointsAwarded } });
    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usesCount: 1 } });

    const fresh = await User.findById(req.user._id).select("rewardPoints").lean();
    return res.json({ ok: true, pointsAwarded, rewardPoints: fresh?.rewardPoints ?? 0 });
  }
);
