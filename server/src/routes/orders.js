import { Router } from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User, isUserApproved } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { canPlaceOrders, canSell, canBeMarketplaceOrderBuyer, canBeStockOrderBuyer } from "../utils/permissions.js";
import { maybeNotifyStockLowAfterDecrease, notifyNewOrderForSeller, notifyOrderStatusChange } from "../services/pushNotify.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth(true));

async function listMyOrders(req, res) {
  const mine = await Order.find({
    $or: [{ buyerId: req.user._id }, { sellerId: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .populate("buyerId", "name businessName role phone")
    .populate("sellerId", "name businessName role phone")
    .populate("items.productId");
  return res.json({ orders: mine });
}

/** Order history: all orders where you are buyer or seller (newest first). */
ordersRouter.get("/", listMyOrders);
ordersRouter.get("/history", listMyOrders);

ordersRouter.post(
  "/",
  [
    body("sellerId").isMongoId(),
    body("items").isArray({ min: 1 }),
    body("items.*.productId").isMongoId(),
    body("items.*.quantity").isInt({ min: 1 }),
    body("orderChannel").optional().isIn(["marketplace", "stock"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sellerId, items, notes } = req.body;
    const orderChannel = req.body.orderChannel === "stock" ? "stock" : "marketplace";

    if (String(sellerId) === String(req.user._id)) {
      return res.status(400).json({ error: "Cannot order from yourself" });
    }

    if (!canPlaceOrders(req.user)) {
      return res.status(403).json({ error: "You are not allowed to place orders" });
    }

    if (orderChannel === "stock") {
      if (!canBeStockOrderBuyer(req.user)) {
        return res.status(403).json({
          error: "Only distributors and retailers may place stock orders from the company catalog",
          code: "STOCK_ORDER_ROLE",
        });
      }
    } else if (!canBeMarketplaceOrderBuyer(req.user)) {
      return res.status(403).json({
        error: "Company accounts do not place marketplace orders here",
        code: "MARKETPLACE_ORDER_ROLE",
      });
    }

    const sellerUser = await User.findById(sellerId).select("permissions status role");
    if (!sellerUser || !isUserApproved(sellerUser)) {
      return res.status(400).json({ error: "Seller not available" });
    }
    if ((sellerUser.role === "company" || sellerUser.role === "distributor" || sellerUser.role === "retail") && !canSell(sellerUser)) {
      return res.status(403).json({ error: "This seller is not permitted to receive orders" });
    }

    if (orderChannel === "stock") {
      if (sellerUser.role !== "company") {
        return res.status(403).json({
          error: "Stock orders must purchase from your linked company catalog (seller must be the company)",
          code: "STOCK_SELLER_INVALID",
        });
      }
      if (!req.user.companyId || !req.user.companyId.equals(sellerUser._id)) {
        return res.status(403).json({
          error: "You can only buy stock from the company your account is linked to",
          code: "STOCK_COMPANY_MISMATCH",
        });
      }
    }

    const sellerOid = new mongoose.Types.ObjectId(sellerId);
    let total = 0;
    const normalized = [];
    const stockChecks = [];
    const touched = [];

    try {
      for (const line of items) {
        const product = await Product.findById(line.productId);
        if (!product) throw new Error("Product not found");
        if (!product.sellerId.equals(sellerOid)) {
          throw new Error("Each product must be sold by the selected seller");
        }
        if (product.quantity < line.quantity) throw new Error("Insufficient stock");

        const unitPrice = product.price;
        const lineTotal = unitPrice * line.quantity;
        total += lineTotal;

        const qtyBeforeLine = product.quantity;
        touched.push({ product, prevQty: qtyBeforeLine });
        product.quantity -= line.quantity;
        await product.save();
        stockChecks.push({ productId: product._id, qtyBeforeLine });

        normalized.push({
          productId: product._id,
          quantity: line.quantity,
          unitPrice,
          title: product.name,
        });
      }

      const order = await Order.create({
        buyerId: req.user._id,
        sellerId,
        items: normalized,
        total,
        notes: notes || "",
        status: "pending",
      });

      for (const sc of stockChecks) {
        const p = await Product.findById(sc.productId);
        if (p) void maybeNotifyStockLowAfterDecrease(p, sc.qtyBeforeLine).catch(() => {});
      }

      const populated = await Order.findById(order._id)
        .populate("buyerId", "name businessName role phone")
        .populate("sellerId", "name businessName role phone")
        .populate("items.productId");
      void notifyNewOrderForSeller(populated).catch(() => {});
      return res.status(201).json({ order: populated });
    } catch (e) {
      for (const { product, prevQty } of touched) {
        try {
          product.quantity = prevQty;
          await product.save();
        } catch {
          /* best-effort rollback */
        }
      }
      return res.status(400).json({ error: e.message || "Order failed" });
    }
  }
);

ordersRouter.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid order id" });
  }
  const order = await Order.findById(req.params.id)
    .populate("buyerId", "name businessName role phone")
    .populate("sellerId", "name businessName role phone")
    .populate("items.productId");
  if (!order) return res.status(404).json({ error: "Not found" });
  const isSeller = order.sellerId.equals(req.user._id);
  const isBuyer = order.buyerId.equals(req.user._id);
  if (!isSeller && !isBuyer) return res.status(403).json({ error: "Forbidden" });
  return res.json({ order });
});

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "completed", "cancelled"];

ordersRouter.patch(
  "/:id/status",
  [body("status").isIn(ORDER_STATUSES)],
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });

    const isSeller = order.sellerId.equals(req.user._id);
    const isBuyer = order.buyerId.equals(req.user._id);
    if (!isSeller && !isBuyer) return res.status(403).json({ error: "Forbidden" });

    if (isBuyer && !["cancelled"].includes(status)) {
      return res.status(403).json({ error: "Buyer can only cancel" });
    }

    const previousStatus = order.status;
    order.status = status;
    await order.save();
    const populated = await Order.findById(order._id)
      .populate("buyerId", "name businessName role phone")
      .populate("sellerId", "name businessName role phone")
      .populate("items.productId");
    if (previousStatus !== status) {
      void notifyOrderStatusChange(populated, previousStatus).catch(() => {});
    }
    return res.json({ order: populated });
  }
);
