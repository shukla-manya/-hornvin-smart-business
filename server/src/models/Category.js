import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", categorySchema);
