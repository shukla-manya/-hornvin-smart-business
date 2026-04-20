import { PushDevice } from "../models/PushDevice.js";
import { recordInAppNotification } from "./inAppNotify.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function pushConfigured() {
  return Boolean(process.env.EXPO_ACCESS_TOKEN && String(process.env.PUSH_SEND_ENABLED || "").toLowerCase() === "true");
}

async function expoSend(messages) {
  if (!messages.length) return { sent: 0 };
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(messages),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("[push] Expo API error:", res.status, json);
    return { sent: 0, error: json };
  }
  return { sent: messages.length, data: json };
}

export async function getPushTokensForUsers(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return [];
  const rows = await PushDevice.find({ userId: { $in: ids } }).lean();
  return [...new Set(rows.map((r) => r.token).filter(Boolean))];
}

/**
 * Best-effort Expo push. When not configured, logs in non-production (no throw).
 */
export async function sendPushToUsers(userIds, { title, body, data = {} }) {
  const payload = { title, body, data: { ...data, title, body } };
  if (!pushConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[push:skipped]", payload.title, "→", userIds?.length || 0, "user(s)", JSON.stringify(data));
    }
    return { skipped: true };
  }
  const tokens = await getPushTokensForUsers(userIds);
  if (!tokens.length) return { skipped: true, reason: "no_tokens" };

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    data: payload.data,
  }));

  try {
    return await expoSend(messages);
  } catch (e) {
    console.warn("[push] send failed:", e.message);
    return { sent: 0, error: e.message };
  }
}

export async function notifyNewChatMessage({ room, message, senderId }) {
  const targets = room.participants.filter((p) => !p.equals(senderId)).map((p) => p.toString());
  if (!targets.length) return;
  const sender =
    message.senderId?.businessName || message.senderId?.name || message.senderId?.email || "Someone";
  const preview = (message.body || "").slice(0, 100) || "New activity";
  void recordInAppNotification({
    userIds: targets,
    type: "chat_message",
    title: `New message · ${sender}`,
    body: preview,
    roomId: room._id,
  });
  await sendPushToUsers(targets, {
    title: `New message · ${sender}`,
    body: preview,
    data: { type: "chat_message", roomId: String(room._id), messageId: String(message._id) },
  });
}

export async function notifyNewOrderForSeller(order) {
  const sid = order.sellerId?._id || order.sellerId;
  if (!sid) return;
  const buyerName =
    order.buyerId?.businessName || order.buyerId?.name || order.buyerId?.phone || "A buyer";
  void recordInAppNotification({
    userIds: [String(sid)],
    type: "order_new",
    title: "New order",
    body: `From ${buyerName} · ₹${order.total} · ${order.status}`,
    orderId: order._id,
  });
  await sendPushToUsers([String(sid)], {
    title: "New order",
    body: `You have a new order (₹${order.total}). Status: ${order.status}.`,
    data: { type: "order_new", orderId: String(order._id), status: order.status },
  });
}

export async function notifyOrderStatusChange(order, previousStatus) {
  const buyer = order.buyerId?._id || order.buyerId;
  const seller = order.sellerId?._id || order.sellerId;
  const ids = [buyer, seller].filter(Boolean).map(String);
  void recordInAppNotification({
    userIds: ids,
    type: "order_status",
    title: "Order updated",
    body: `Order is now ${order.status}${previousStatus ? ` (was ${previousStatus})` : ""}.`,
    orderId: order._id,
  });
  await sendPushToUsers(ids, {
    title: "Order updated",
    body: `Order is now ${order.status}${previousStatus ? ` (was ${previousStatus})` : ""}.`,
    data: {
      type: "order_status",
      orderId: String(order._id),
      status: order.status,
      previousStatus: previousStatus || "",
    },
  });
}

export async function notifyStockLow({ sellerUserId, product }) {
  if (!sellerUserId) return;
  void recordInAppNotification({
    userIds: [String(sellerUserId)],
    type: "stock_alert",
    title: "Low stock",
    body: `${product.name} is down to ${product.quantity} unit(s).`,
    productId: product._id,
  });
  await sendPushToUsers([String(sellerUserId)], {
    title: "Low stock",
    body: `${product.name} is down to ${product.quantity} unit(s).`,
    data: { type: "stock_alert", productId: String(product._id), quantity: product.quantity },
  });
}

export function stockLowThreshold() {
  const n = Number(process.env.STOCK_LOW_THRESHOLD);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/** Call after quantity decreased: notify seller when at/below threshold. */
export async function maybeNotifyStockLowAfterDecrease(product, previousQuantity) {
  const th = stockLowThreshold();
  const q = product.quantity;
  if (previousQuantity <= q) return;
  if (q > th) return;
  const sellerId = product.sellerId?._id || product.sellerId;
  if (!sellerId) return;
  await notifyStockLow({ sellerUserId: sellerId, product });
}
