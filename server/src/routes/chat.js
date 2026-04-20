import { Router } from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import { ChatRoom } from "../models/ChatRoom.js";
import { Message } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyNewChatMessage } from "../services/pushNotify.js";

export const chatRouter = Router();
chatRouter.use(requireAuth(true));

async function findOrCreateRoom(a, b) {
  const sorted = [String(a), String(b)].sort();
  const ids = sorted.map((s) => new mongoose.Types.ObjectId(s));
  let room = await ChatRoom.findOne({
    participants: { $all: ids, $size: 2 },
  });
  if (!room) {
    room = await ChatRoom.create({ participants: ids });
  }
  return room;
}

chatRouter.get("/rooms", async (req, res) => {
  const rooms = await ChatRoom.find({ participants: req.user._id })
    .sort({ lastMessageAt: -1 })
    .populate("participants", "name businessName role phone email");
  return res.json({ rooms });
});

const openRoomValidators = [body("withUserId").isMongoId()];

async function openOrCreateChatRoom(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { withUserId } = req.body;
  if (String(withUserId) === String(req.user._id)) {
    return res.status(400).json({ error: "Invalid peer" });
  }
  const room = await findOrCreateRoom(req.user._id, withUserId);
  await room.populate("participants", "name businessName role phone email");
  return res.json({ room });
}

/** Create (or reopen) a 1:1 chat with another user. Body: { withUserId }. */
chatRouter.post("/rooms", openRoomValidators, openOrCreateChatRoom);
chatRouter.post("/rooms/open", openRoomValidators, openOrCreateChatRoom);

chatRouter.get("/rooms/:roomId/messages", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.roomId)) {
    return res.status(400).json({ error: "Invalid room id" });
  }
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Not found" });
  if (!room.participants.some((p) => p.equals(req.user._id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const messages = await Message.find({ roomId: room._id })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate("senderId", "name businessName role")
    .populate("productId")
    .populate("orderId");
  return res.json({ messages });
});

chatRouter.post(
  "/rooms/:roomId/messages",
  [body("body").optional().isString(), body("productId").optional().isMongoId(), body("orderId").optional().isMongoId()],
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const text = (req.body.body || "").trim();
    const hasProduct = !!req.body.productId;
    const hasOrder = !!req.body.orderId;
    if (!text && !hasProduct && !hasOrder) {
      return res.status(400).json({ error: "Message needs text and/or a product or order reference" });
    }

    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: "Not found" });
    if (!room.participants.some((p) => p.equals(req.user._id))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const msg = await Message.create({
      roomId: room._id,
      senderId: req.user._id,
      body: text,
      productId: req.body.productId,
      orderId: req.body.orderId,
    });

    room.lastMessageAt = new Date();
    room.lastPreview = text.slice(0, 140) || (hasProduct ? "[Product]" : hasOrder ? "[Order]" : "");
    await room.save();

    await msg.populate("senderId", "name businessName role");
    await msg.populate("productId");
    await msg.populate("orderId");

    // Optional real-time: clients should join the room via Socket (`room:join`) for live delivery; REST always works.
    const io = req.app.get("io");
    if (io) {
      const rid = String(room._id);
      io.to(rid).emit("message:new", { message: msg });
      const updated = {
        roomId: rid,
        lastPreview: room.lastPreview,
        lastMessageAt: room.lastMessageAt,
      };
      for (const pid of room.participants) {
        io.to(`user:${pid.toString()}`).emit("chat:room:updated", updated);
      }
    }

    void notifyNewChatMessage({ room, message: msg, senderId: req.user._id }).catch(() => {});

    return res.status(201).json({ message: msg });
  }
);
