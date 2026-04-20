import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
wishlistItemSchema.index({ userId: 1, createdAt: -1 });

export const WishlistItem = mongoose.model("WishlistItem", wishlistItemSchema);
