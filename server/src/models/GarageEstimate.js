import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["service", "part"], required: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const garageEstimateSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    garageCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageCustomer" },
    garageVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageVehicle" },
    title: { type: String, trim: true, default: "" },
    lineItems: { type: [lineSchema], default: [] },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    subtotal: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["draft", "sent", "converted"], default: "draft" },
    shopInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageShopInvoice" },
  },
  { timestamps: true }
);

garageEstimateSchema.index({ garageUserId: 1, createdAt: -1 });

export const GarageEstimate = mongoose.model("GarageEstimate", garageEstimateSchema);
