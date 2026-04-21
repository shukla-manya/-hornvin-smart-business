import { Router } from "express";
import { body, validationResult } from "express-validator";
import { Payment, PAYMENT_METHODS, PAYMENT_STATUSES } from "../models/Payment.js";
import { Order } from "../models/Order.js";
import { Invoice } from "../models/Invoice.js";
import { requireAuth } from "../middleware/auth.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth(true));

paymentsRouter.get("/", async (req, res) => {
  const list = await Payment.find({
    $or: [{ payerId: req.user._id }, { payeeId: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .populate("payerId", "name businessName phone email role upiVpa upiMerchantName")
    .populate("payeeId", "name businessName phone email role upiVpa upiMerchantName")
    .populate("orderId")
    .populate("invoiceId");
  return res.json({ payments: list });
});

paymentsRouter.post(
  "/",
  [
    body("payeeId").isMongoId(),
    body("amount").isFloat({ gt: 0 }),
    body("method").optional().isIn(PAYMENT_METHODS),
    body("currency").optional().isString(),
    body("orderId").optional().isMongoId(),
    body("invoiceId").optional().isMongoId(),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { payeeId, amount, method, currency, orderId, invoiceId, notes } = req.body;
    if (String(payeeId) === String(req.user._id)) {
      return res.status(400).json({ error: "Payee must differ from payer" });
    }

    if (orderId) {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const ok =
        order.buyerId.equals(req.user._id) ||
        order.sellerId.equals(req.user._id) ||
        order.buyerId.equals(payeeId) ||
        order.sellerId.equals(payeeId);
      if (!ok) return res.status(403).json({ error: "Order not linked to parties" });
    }

    if (invoiceId) {
      const inv = await Invoice.findById(invoiceId);
      if (!inv) return res.status(404).json({ error: "Invoice not found" });
      if (!inv.customerId.equals(req.user._id) && !inv.issuerId.equals(req.user._id)) {
        return res.status(403).json({ error: "Invoice not linked to you" });
      }
    }

    const payment = await Payment.create({
      payerId: req.user._id,
      payeeId,
      amount,
      method: method || "unknown",
      currency: currency || "INR",
      orderId: orderId || undefined,
      invoiceId: invoiceId || undefined,
      notes: notes || "",
      status: "pending",
    });

    const populated = await Payment.findById(payment._id)
      .populate("payerId", "name businessName phone email role")
      .populate("payeeId", "name businessName phone email role")
      .populate("orderId")
      .populate("invoiceId");

    return res.status(201).json({ payment: populated });
  }
);

paymentsRouter.patch(
  "/:id/status",
  [body("status").isIn(PAYMENT_STATUSES)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Not found" });

    const isPayer = payment.payerId.equals(req.user._id);
    const isPayee = payment.payeeId.equals(req.user._id);
    if (!isPayer && !isPayee) return res.status(403).json({ error: "Forbidden" });

    const { status } = req.body;
    if (status === "completed" && !isPayee) {
      return res.status(403).json({ error: "Only payee can mark completed" });
    }
    if (status === "failed" && !isPayer) {
      return res.status(403).json({ error: "Only payer can mark failed" });
    }
    if (status === "refunded" && !isPayee) {
      return res.status(403).json({ error: "Only payee can mark refunded" });
    }

    payment.status = status;
    await payment.save();

    if (status === "completed" && payment.invoiceId) {
      const inv = await Invoice.findById(payment.invoiceId);
      if (inv && inv.customerId.equals(payment.payerId)) {
        inv.status = "paid";
        await inv.save();
      }
    }

    const populated = await Payment.findById(payment._id)
      .populate("payerId", "name businessName phone email role")
      .populate("payeeId", "name businessName phone email role")
      .populate("orderId")
      .populate("invoiceId");

    return res.json({ payment: populated });
  }
);
