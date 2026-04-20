import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    isPrimary: { type: Boolean, default: false },
    roleContext: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "locations" }
);

locationSchema.index({ userId: 1 });
locationSchema.index({ geo: "2dsphere" });
locationSchema.index({ userId: 1, isPrimary: 1 });

export const Location = mongoose.model("Location", locationSchema);
