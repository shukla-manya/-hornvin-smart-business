import mongoose from "mongoose";

const TYPES = ["order_new", "order_status", "chat_message", "stock_alert", "system"];

const inAppNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    readAt: { type: Date, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  },
  { timestamps: true }
);

inAppNotificationSchema.index({ userId: 1, createdAt: -1 });

export const InAppNotification = mongoose.model("InAppNotification", inAppNotificationSchema);
