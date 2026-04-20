import { InAppNotification } from "../models/InAppNotification.js";

/**
 * Persist one in-app notification per recipient (best-effort; never throws to callers).
 */
export async function recordInAppNotification({
  userIds,
  type,
  title,
  body = "",
  orderId,
  roomId,
  productId,
}) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length || !type || !title) return;
  try {
    const docs = ids.map((userId) => ({
      userId,
      type,
      title,
      body,
      orderId: orderId || undefined,
      roomId: roomId || undefined,
      productId: productId || undefined,
    }));
    await InAppNotification.insertMany(docs);
  } catch (e) {
    console.warn("[inAppNotify] insert failed:", e.message);
  }
}
