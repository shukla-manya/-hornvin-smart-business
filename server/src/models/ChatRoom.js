import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessageAt: { type: Date, default: Date.now },
    lastPreview: { type: String, default: "" },
  },
  { timestamps: true }
);

chatRoomSchema.index({ participants: 1 });

export const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);
