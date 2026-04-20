import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, default: "" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
