import mongoose from "mongoose";

const garageCustomerSchema = new mongoose.Schema(
  {
    garageUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    vehiclePlate: { type: String, trim: true, default: "" },
    vehicleModel: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    nextReminderAt: { type: Date },
    reminderLabel: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

garageCustomerSchema.index({ garageUserId: 1, name: 1 });
garageCustomerSchema.index({ garageUserId: 1, nextReminderAt: 1 });

export const GarageCustomer = mongoose.model("GarageCustomer", garageCustomerSchema);
