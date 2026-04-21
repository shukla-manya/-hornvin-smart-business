import mongoose from "mongoose";

const invLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const garageShopInvoiceSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    number: { type: String, required: true, unique: true },
    garageCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageCustomer" },
    garageVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageVehicle" },
    estimateId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageEstimate" },
    lines: { type: [invLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

garageShopInvoiceSchema.index({ garageUserId: 1, createdAt: -1 });

export const GarageShopInvoice = mongoose.model("GarageShopInvoice", garageShopInvoiceSchema);
