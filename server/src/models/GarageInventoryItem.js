import mongoose from "mongoose";

const garageInventoryItemSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: "" },
    quantity: { type: Number, default: 0, min: 0 },
    reorderAt: { type: Number, default: 0, min: 0 },
    unit: { type: String, trim: true, default: "pcs" },
    notes: { type: String, trim: true, default: "" },
    linkedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  },
  { timestamps: true }
);

garageInventoryItemSchema.index({ garageUserId: 1, name: 1 });

export const GarageInventoryItem = mongoose.model("GarageInventoryItem", garageInventoryItemSchema);
