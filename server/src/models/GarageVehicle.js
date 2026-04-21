import mongoose from "mongoose";

const garageVehicleSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    garageCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "GarageCustomer", required: true, index: true },
    plateNumber: { type: String, trim: true, required: true },
    model: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

garageVehicleSchema.index({ garageUserId: 1, garageCustomerId: 1, plateNumber: 1 });

export const GarageVehicle = mongoose.model("GarageVehicle", garageVehicleSchema);
