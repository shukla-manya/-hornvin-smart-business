import { Router } from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import { PushDevice } from "../models/PushDevice.js";
import { InAppNotification } from "../models/InAppNotification.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

/**
 * Push delivery is intentionally not implemented yet (FCM / Expo / APNs wiring comes later).
 * Device tokens are stored so a worker can send once a provider is configured.
 */
notificationsRouter.get("/push-status", requireAuth(true), (_req, res) => {
  const provider = process.env.PUSH_PROVIDER || "none";
  const expoReady = Boolean(process.env.EXPO_ACCESS_TOKEN);
  const sendingEnabled = String(process.env.PUSH_SEND_ENABLED || "").toLowerCase() === "true" && expoReady;
  return res.json({
    provider,
    expoAccessTokenConfigured: expoReady,
    sendingEnabled,
    triggers: ["chat_message", "order_new", "order_status", "stock_alert"],
    message: sendingEnabled
      ? "Expo push is enabled; device tokens receive new messages, order updates, and low-stock alerts."
      : "Set EXPO_ACCESS_TOKEN (Expo project) and PUSH_SEND_ENABLED=true to deliver pushes. Until then, events are logged in non-production.",
  });
});

notificationsRouter.post(
  "/device-token",
  requireAuth(true),
  [
    body("token").isString().trim().notEmpty(),
    body("platform").optional().isIn(["ios", "android", "expo", "web", "unknown"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const token = req.body.token.trim();
    const platform = req.body.platform || "unknown";

    await PushDevice.findOneAndUpdate(
      { userId: req.user._id, token },
      { userId: req.user._id, token, platform },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ ok: true, registered: true, pushDelivery: "deferred" });
  }
);

notificationsRouter.post(
  "/device-token/remove",
  requireAuth(true),
  [body("token").isString().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    await PushDevice.deleteMany({ userId: req.user._id, token: req.body.token.trim() });
    return res.json({ ok: true });
  }
);

notificationsRouter.get("/devices", requireAuth(true), async (req, res) => {
  const devices = await PushDevice.find({ userId: req.user._id })
    .select("_id platform createdAt updatedAt")
    .lean();
  return res.json({ devices });
});

/** In-app feed: order, chat, and stock events (see `services/pushNotify.js` + `inAppNotify.js`). */
notificationsRouter.get("/", requireAuth(true), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await InAppNotification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("type title body readAt orderId roomId productId createdAt")
    .lean();

  const notifications = rows.map((n) => ({
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.readAt,
    orderId: n.orderId ? String(n.orderId) : null,
    roomId: n.roomId ? String(n.roomId) : null,
    productId: n.productId ? String(n.productId) : null,
    createdAt: n.createdAt,
  }));

  return res.json({
    notifications,
    meta: { source: "in_app", unreadCount: notifications.filter((n) => !n.readAt).length },
  });
});

notificationsRouter.patch("/:id/read", requireAuth(true), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const n = await InAppNotification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { readAt: new Date() },
    { new: true }
  ).lean();
  if (!n) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, notification: { id: String(n._id), readAt: n.readAt } });
});

notificationsRouter.post("/read-all", requireAuth(true), async (req, res) => {
  const r = await InAppNotification.updateMany(
    { userId: req.user._id, readAt: null },
    { readAt: new Date() }
  );
  return res.json({ ok: true, modified: r.modifiedCount ?? 0 });
});
