import mongoose from "mongoose";

const METHODS = ["cash", "upi", "bank", "card", "unknown"];
const STATUSES = ["pending", "completed", "failed", "refunded"];

const paymentSchema = new mongoose.Schema(
  {
    payerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    payeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    method: { type: String, enum: METHODS, default: "unknown" },
    status: { type: String, enum: STATUSES, default: "pending" },
    externalRef: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ payerId: 1, createdAt: -1 });
paymentSchema.index({ payeeId: 1, createdAt: -1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ invoiceId: 1, status: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
export const PAYMENT_METHODS = METHODS;
export const PAYMENT_STATUSES = STATUSES;
