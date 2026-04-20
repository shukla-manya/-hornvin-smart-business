import mongoose from "mongoose";

const pushDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: ["ios", "android", "expo", "web", "unknown"],
      default: "unknown",
    },
  },
  { timestamps: true, collection: "push_devices" }
);

pushDeviceSchema.index({ userId: 1, token: 1 }, { unique: true });

export const PushDevice = mongoose.model("PushDevice", pushDeviceSchema);
