import { Router } from "express";
import { body, validationResult } from "express-validator";
import { Invoice } from "../models/Invoice.js";
import { Order } from "../models/Order.js";
import { Payment, PAYMENT_METHODS } from "../models/Payment.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

function nextInvoiceNumber() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HV-${t}-${r}`;
}

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth(true));

invoicesRouter.get("/", async (req, res) => {
  const list = await Invoice.find({
    $or: [{ issuerId: req.user._id }, { customerId: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .populate("issuerId", "name businessName phone email")
    .populate("customerId", "name businessName phone email")
    .populate("orderId");
  return res.json({ invoices: list });
});

invoicesRouter.post(
  "/from-order",
  allowRoles("company", "distributor", "retail"),
  [body("orderId").isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const order = await Order.findById(req.body.orderId).populate("items.productId");
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isSeller = order.sellerId.equals(req.user._id);
    if (!isSeller) return res.status(403).json({ error: "Only seller can invoice" });

    const lines = order.items.map((it) => ({
      description: it.title || it.productId?.name || "Item",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: it.quantity * it.unitPrice,
    }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);

    const invoice = await Invoice.create({
      issuerId: req.user._id,
      customerId: order.buyerId,
      orderId: order._id,
      number: nextInvoiceNumber(),
      lines,
      subtotal,
      tax: 0,
      total: subtotal,
      status: "sent",
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("issuerId", "name businessName phone email address")
      .populate("customerId", "name businessName phone email address")
      .populate("orderId");

    return res.status(201).json({ invoice: populated });
  }
);

invoicesRouter.patch(
  "/:id/status",
  [
    body("status").isIn(["draft", "sent", "paid", "overdue"]),
    body("method").optional().isIn(PAYMENT_METHODS),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { status, method, notes } = req.body;

    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: "Not found" });

    const isIssuer = inv.issuerId.equals(req.user._id);
    const isCustomer = inv.customerId.equals(req.user._id);
    if (!isIssuer && !isCustomer) return res.status(403).json({ error: "Forbidden" });

    if (isCustomer && status !== "paid") {
      return res.status(403).json({ error: "Customer can mark paid only" });
    }

    if (status === "paid" && !isCustomer) {
      return res.status(403).json({ error: "Only the customer can mark an invoice paid" });
    }

    if (status === "paid" && inv.status === "paid") {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    inv.status = status;
    await inv.save();

    if (status === "paid" && isCustomer) {
      const hasCompleted = await Payment.exists({ invoiceId: inv._id, status: "completed" });
      if (!hasCompleted) {
        await Payment.create({
          payerId: inv.customerId,
          payeeId: inv.issuerId,
          amount: inv.total,
          currency: "INR",
          method: method || "unknown",
          invoiceId: inv._id,
          orderId: inv.orderId || undefined,
          notes: (notes || "").trim() || "Invoice marked paid",
          status: "completed",
        });
      }
    }

    const populated = await Invoice.findById(inv._id)
      .populate("issuerId", "name businessName phone email")
      .populate("customerId", "name businessName phone email")
      .populate("orderId");
    return res.json({ invoice: populated });
  }
);
