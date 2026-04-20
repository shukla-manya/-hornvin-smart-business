import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    title: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "completed", "cancelled"],
      default: "pending",
    },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
