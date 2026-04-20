import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";
import { WishlistItem } from "../models/WishlistItem.js";
import { Product } from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth(true));

wishlistRouter.get("/", async (req, res) => {
  const rows = await WishlistItem.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate("productId")
    .lean();
  return res.json({ items: rows });
});

wishlistRouter.get("/status/:productId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }
  const row = await WishlistItem.findOne({
    userId: req.user._id,
    productId: req.params.productId,
  })
    .select("_id")
    .lean();
  return res.json({ inWishlist: Boolean(row) });
});

wishlistRouter.post("/", [body("productId").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const product = await Product.findById(req.body.productId).select("_id");
  if (!product) return res.status(404).json({ error: "Product not found" });

  try {
    const row = await WishlistItem.findOneAndUpdate(
      { userId: req.user._id, productId: product._id },
      { userId: req.user._id, productId: product._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("productId");
    return res.status(201).json({ item: row });
  } catch (e) {
    if (e.code === 11000) {
      const existing = await WishlistItem.findOne({
        userId: req.user._id,
        productId: product._id,
      }).populate("productId");
      return res.json({ item: existing, alreadySaved: true });
    }
    return res.status(400).json({ error: e.message || "Could not save" });
  }
});

wishlistRouter.delete("/:productId", [param("productId").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const r = await WishlistItem.deleteOne({ userId: req.user._id, productId: req.params.productId });
  return res.json({ ok: true, removed: r.deletedCount || 0 });
});
