import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    /** Brand / upstream company (always the company account id for distributor listings). */
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Listing owner: same as company for company posts, or distributor user for distributor posts. */
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    /** spare_part | vehicle | other — garage marketplace listing kind. */
    listingType: { type: String, enum: ["spare_part", "vehicle", "other"], default: "other" },
    /** Platform-wide catalog rows (Super Admin); listed in marketplace for all buyers. */
    isGlobalCatalog: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ isGlobalCatalog: 1, category: 1 });
productSchema.index({ companyId: 1, category: 1 });
productSchema.index({ sellerId: 1, category: 1 });
productSchema.index({ name: "text", description: "text", category: "text" });

export const Product = mongoose.model("Product", productSchema);
