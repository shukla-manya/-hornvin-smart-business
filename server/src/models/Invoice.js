import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    issuerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    number: { type: String, required: true, unique: true },
    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["draft", "sent", "paid", "overdue"], default: "sent" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

invoiceSchema.index({ issuerId: 1, createdAt: -1 });
invoiceSchema.index({ customerId: 1, createdAt: -1 });

export const Invoice = mongoose.model("Invoice", invoiceSchema);
