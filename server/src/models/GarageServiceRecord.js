import mongoose from "mongoose";

const garageServiceRecordSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    garageCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageCustomer" },
    garageVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageVehicle" },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    vehiclePlate: { type: String, trim: true, default: "" },
    vehicleModel: { type: String, trim: true, default: "" },
    summary: { type: String, trim: true, required: true },
    odometerKm: { type: Number, min: 0 },
    laborHours: { type: Number, min: 0, default: 0 },
    partsUsed: { type: String, trim: true, default: "" },
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

garageServiceRecordSchema.index({ garageUserId: 1, performedAt: -1 });

export const GarageServiceRecord = mongoose.model("GarageServiceRecord", garageServiceRecordSchema);
