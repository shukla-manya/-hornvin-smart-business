import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { GarageInventoryItem } from "../models/GarageInventoryItem.js";
import { GarageServiceRecord } from "../models/GarageServiceRecord.js";
import { GarageCustomer } from "../models/GarageCustomer.js";
import { GarageVehicle } from "../models/GarageVehicle.js";
import { GarageEstimate } from "../models/GarageEstimate.js";
import { GarageShopInvoice } from "../models/GarageShopInvoice.js";

export const garageRouter = Router();
garageRouter.use(requireAuth(true), allowRoles("retail"));

function buildCallScript({ customerName, topic, vehicle }) {
  const who = customerName?.trim() || "there";
  const veh = vehicle?.trim();
  const subj = topic?.trim() || "your vehicle service with Hornvin Garage";
  const open = `Hi ${who}, this is Hornvin Garage calling about ${subj}.`;
  const mid = veh
    ? ` We have ${veh} on file — I wanted to confirm a convenient time and answer any questions.`
    : " I wanted to confirm a convenient time and answer any questions.";
  const close =
    " If now is not a good time, I can send a WhatsApp summary or book you in for a callback. Does later today or tomorrow morning work better?";
  const compliance = " This call may be recorded for quality and training.";
  return `${open}${mid}${close}${compliance}`;
}

garageRouter.get("/summary", async (req, res) => {
  const uid = req.user._id;
  const [
    inventoryCount,
    lowStock,
    serviceCount,
    customerCount,
    upcomingReminders,
    vehicleCount,
    estimateDraftCount,
    shopInvoicePending,
  ] = await Promise.all([
    GarageInventoryItem.countDocuments({ garageUserId: uid }),
    GarageInventoryItem.countDocuments({ garageUserId: uid, $expr: { $lte: ["$quantity", "$reorderAt"] } }),
    GarageServiceRecord.countDocuments({ garageUserId: uid }),
    GarageCustomer.countDocuments({ garageUserId: uid }),
    GarageCustomer.countDocuments({
      garageUserId: uid,
      nextReminderAt: { $exists: true, $ne: null, $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    }),
    GarageVehicle.countDocuments({ garageUserId: uid }),
    GarageEstimate.countDocuments({ garageUserId: uid, status: { $in: ["draft", "sent"] } }),
    GarageShopInvoice.countDocuments({ garageUserId: uid, paymentStatus: { $ne: "paid" } }),
  ]);
  return res.json({
    inventoryCount,
    lowStockCount: lowStock,
    serviceHistoryCount: serviceCount,
    customerCount,
    remindersDueSoon: upcomingReminders,
    vehicleCount,
    estimateOpenCount: estimateDraftCount,
    shopInvoiceOpenCount: shopInvoicePending,
  });
});

/** --- Inventory --- */
garageRouter.get("/inventory", async (req, res) => {
  const items = await GarageInventoryItem.find({ garageUserId: req.user._id }).sort({ updatedAt: -1 }).lean();
  return res.json({ items });
});

garageRouter.post(
  "/inventory",
  [
    body("name").isString().trim().notEmpty(),
    body("sku").optional().isString().trim(),
    body("quantity").optional().isFloat({ min: 0 }),
    body("reorderAt").optional().isFloat({ min: 0 }),
    body("unit").optional().isString().trim(),
    body("notes").optional().isString().trim(),
    body("linkedProductId").optional().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await GarageInventoryItem.create({
      garageUserId: req.user._id,
      name: req.body.name,
      sku: req.body.sku || "",
      quantity: req.body.quantity ?? 0,
      reorderAt: req.body.reorderAt ?? 0,
      unit: req.body.unit || "pcs",
      notes: req.body.notes || "",
      linkedProductId: req.body.linkedProductId || undefined,
    });
    return res.status(201).json({ item: doc });
  }
);

garageRouter.patch(
  "/inventory/:id",
  [
    param("id").isMongoId(),
    body("name").optional().isString().trim().notEmpty(),
    body("sku").optional().isString().trim(),
    body("quantity").optional().isFloat({ min: 0 }),
    body("reorderAt").optional().isFloat({ min: 0 }),
    body("unit").optional().isString().trim(),
    body("notes").optional().isString().trim(),
    body("linkedProductId").optional().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const item = await GarageInventoryItem.findOne({ _id: req.params.id, garageUserId: req.user._id });
    if (!item) return res.status(404).json({ error: "Not found" });
    const b = req.body;
    if (b.name !== undefined) item.name = b.name;
    if (b.sku !== undefined) item.sku = b.sku;
    if (b.quantity !== undefined) item.quantity = b.quantity;
    if (b.reorderAt !== undefined) item.reorderAt = b.reorderAt;
    if (b.unit !== undefined) item.unit = b.unit;
    if (b.notes !== undefined) item.notes = b.notes;
    if (b.linkedProductId !== undefined) item.linkedProductId = b.linkedProductId || undefined;
    await item.save();
    return res.json({ item });
  }
);

garageRouter.delete("/inventory/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await GarageInventoryItem.deleteOne({ _id: req.params.id, garageUserId: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

/** --- Service history --- */
garageRouter.get("/service-records", async (req, res) => {
  const records = await GarageServiceRecord.find({ garageUserId: req.user._id }).sort({ performedAt: -1 }).limit(200).lean();
  return res.json({ records });
});

garageRouter.post(
  "/service-records",
  [
    body("summary").isString().trim().notEmpty(),
    body("garageCustomerId").optional().isMongoId(),
    body("garageVehicleId").optional().isMongoId(),
    body("customerName").optional().isString().trim(),
    body("customerPhone").optional().isString().trim(),
    body("vehiclePlate").optional().isString().trim(),
    body("vehicleModel").optional().isString().trim(),
    body("odometerKm").optional().isFloat({ min: 0 }),
    body("laborHours").optional().isFloat({ min: 0 }),
    body("partsUsed").optional().isString().trim(),
    body("performedAt").optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    let customerName = req.body.customerName || "";
    let customerPhone = req.body.customerPhone || "";
    let vehiclePlate = req.body.vehiclePlate || "";
    let vehicleModel = req.body.vehicleModel || "";
    let garageCustomerId = req.body.garageCustomerId || undefined;
    let garageVehicleId = req.body.garageVehicleId || undefined;

    if (garageCustomerId) {
      const gc = await GarageCustomer.findOne({ _id: garageCustomerId, garageUserId: req.user._id });
      if (!gc) return res.status(400).json({ error: "Customer not found" });
      if (!customerName) customerName = gc.name || "";
      if (!customerPhone) customerPhone = gc.phone || "";
      if (!vehiclePlate) vehiclePlate = gc.vehiclePlate || "";
      if (!vehicleModel) vehicleModel = gc.vehicleModel || "";
    }
    if (garageVehicleId) {
      const gv = await GarageVehicle.findOne({ _id: garageVehicleId, garageUserId: req.user._id });
      if (!gv) return res.status(400).json({ error: "Vehicle not found" });
      vehiclePlate = vehiclePlate || gv.plateNumber || "";
      vehicleModel = vehicleModel || gv.model || "";
      if (!garageCustomerId) garageCustomerId = String(gv.garageCustomerId);
    }

    const doc = await GarageServiceRecord.create({
      garageUserId: req.user._id,
      garageCustomerId: garageCustomerId || undefined,
      garageVehicleId: garageVehicleId || undefined,
      summary: req.body.summary,
      customerName,
      customerPhone,
      vehiclePlate,
      vehicleModel,
      odometerKm: req.body.odometerKm,
      laborHours: req.body.laborHours ?? 0,
      partsUsed: req.body.partsUsed || "",
      performedAt: req.body.performedAt ? new Date(req.body.performedAt) : new Date(),
    });
    return res.status(201).json({ record: doc });
  }
);

garageRouter.delete("/service-records/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await GarageServiceRecord.deleteOne({ _id: req.params.id, garageUserId: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

/** --- Customers & reminders --- */
garageRouter.get("/customers", async (req, res) => {
  const customers = await GarageCustomer.find({ garageUserId: req.user._id }).sort({ nextReminderAt: 1, name: 1 }).lean();
  return res.json({ customers });
});

garageRouter.post(
  "/customers",
  [
    body("name").isString().trim().notEmpty(),
    body("phone").optional().isString().trim(),
    body("email").optional().isEmail(),
    body("vehiclePlate").optional().isString().trim(),
    body("vehicleModel").optional().isString().trim(),
    body("notes").optional().isString().trim(),
    body("nextReminderAt").optional().isISO8601(),
    body("reminderLabel").optional().isString().trim(),
    body("paymentReminderAt").optional().isISO8601(),
    body("paymentReminderLabel").optional().isString().trim(),
    body("automatedMessageTemplate").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await GarageCustomer.create({
      garageUserId: req.user._id,
      name: req.body.name,
      phone: req.body.phone || "",
      email: req.body.email ? String(req.body.email).trim().toLowerCase() : "",
      vehiclePlate: req.body.vehiclePlate || "",
      vehicleModel: req.body.vehicleModel || "",
      notes: req.body.notes || "",
      nextReminderAt: req.body.nextReminderAt ? new Date(req.body.nextReminderAt) : undefined,
      reminderLabel: req.body.reminderLabel || "",
      paymentReminderAt: req.body.paymentReminderAt ? new Date(req.body.paymentReminderAt) : undefined,
      paymentReminderLabel: req.body.paymentReminderLabel || "",
      automatedMessageTemplate: req.body.automatedMessageTemplate || "",
    });
    return res.status(201).json({ customer: doc });
  }
);

garageRouter.patch(
  "/customers/:id",
  [
    param("id").isMongoId(),
    body("name").optional().isString().trim().notEmpty(),
    body("phone").optional().isString().trim(),
    body("email").optional().isString().trim(),
    body("vehiclePlate").optional().isString().trim(),
    body("vehicleModel").optional().isString().trim(),
    body("notes").optional().isString().trim(),
    body("nextReminderAt").optional().isString().trim(),
    body("reminderLabel").optional().isString().trim(),
    body("paymentReminderAt").optional().isString().trim(),
    body("paymentReminderLabel").optional().isString().trim(),
    body("automatedMessageTemplate").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const c = await GarageCustomer.findOne({ _id: req.params.id, garageUserId: req.user._id });
    if (!c) return res.status(404).json({ error: "Not found" });
    const b = req.body;
    if (b.name !== undefined) c.name = b.name;
    if (b.phone !== undefined) c.phone = b.phone;
    if (b.email !== undefined) {
      const em = String(b.email).trim().toLowerCase();
      c.email = em && !em.includes(" ") ? em : "";
    }
    if (b.vehiclePlate !== undefined) c.vehiclePlate = b.vehiclePlate;
    if (b.vehicleModel !== undefined) c.vehicleModel = b.vehicleModel;
    if (b.notes !== undefined) c.notes = b.notes;
    if (b.nextReminderAt !== undefined) {
      const raw = b.nextReminderAt;
      if (raw === null || raw === "" || raw === "null") c.set("nextReminderAt", undefined);
      else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) c.nextReminderAt = d;
      }
    }
    if (b.reminderLabel !== undefined) c.reminderLabel = b.reminderLabel;
    if (b.paymentReminderAt !== undefined) {
      const raw = b.paymentReminderAt;
      if (raw === null || raw === "" || raw === "null") c.set("paymentReminderAt", undefined);
      else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) c.paymentReminderAt = d;
      }
    }
    if (b.paymentReminderLabel !== undefined) c.paymentReminderLabel = b.paymentReminderLabel;
    if (b.automatedMessageTemplate !== undefined) c.automatedMessageTemplate = b.automatedMessageTemplate;
    await c.save();
    return res.json({ customer: c });
  }
);

garageRouter.delete("/customers/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await GarageCustomer.deleteOne({ _id: req.params.id, garageUserId: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

function computeLineItemsTotals(lineItems, taxPercent) {
  let subtotal = 0;
  for (const line of lineItems || []) {
    const q = Number(line.quantity) || 0;
    const p = Number(line.unitPrice) || 0;
    subtotal += Math.round(q * p * 100) / 100;
  }
  const tp = Number(taxPercent) || 0;
  const tax = Math.round(subtotal * (tp / 100) * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

function nextShopInvoiceNumber() {
  return `HVG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function buildCallScriptPurpose({ customerName, vehicle, purpose }) {
  const who = customerName?.trim() || "there";
  const veh = vehicle?.trim();
  if (purpose === "offers") {
    return `Hi ${who}, this is Hornvin Garage with a limited-time offer on parts and labour we think fits ${veh || "your vehicle"}. Would you like a quick quote valid this week? If now is not a good time, I can WhatsApp the details.`;
  }
  return buildCallScript({
    customerName,
    topic: "upcoming service that may be due",
    vehicle: veh,
  });
}

function renderTemplate(tpl, vars) {
  if (!tpl) return "";
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

/** --- Vehicles (per customer) --- */
garageRouter.get("/customers/:customerId/vehicles", [param("customerId").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const cust = await GarageCustomer.findOne({ _id: req.params.customerId, garageUserId: req.user._id });
  if (!cust) return res.status(404).json({ error: "Customer not found" });
  const vehicles = await GarageVehicle.find({ garageUserId: req.user._id, garageCustomerId: cust._id }).sort({ updatedAt: -1 }).lean();
  return res.json({ vehicles });
});

garageRouter.post(
  "/customers/:customerId/vehicles",
  [
    param("customerId").isMongoId(),
    body("plateNumber").isString().trim().notEmpty(),
    body("model").optional().isString().trim(),
    body("notes").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const cust = await GarageCustomer.findOne({ _id: req.params.customerId, garageUserId: req.user._id });
    if (!cust) return res.status(404).json({ error: "Customer not found" });
    const v = await GarageVehicle.create({
      garageUserId: req.user._id,
      garageCustomerId: cust._id,
      plateNumber: req.body.plateNumber.trim(),
      model: req.body.model?.trim() || "",
      notes: req.body.notes?.trim() || "",
    });
    return res.status(201).json({ vehicle: v });
  }
);

garageRouter.patch(
  "/vehicles/:id",
  [
    param("id").isMongoId(),
    body("plateNumber").optional().isString().trim().notEmpty(),
    body("model").optional().isString().trim(),
    body("notes").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const v = await GarageVehicle.findOne({ _id: req.params.id, garageUserId: req.user._id });
    if (!v) return res.status(404).json({ error: "Not found" });
    if (req.body.plateNumber !== undefined) v.plateNumber = req.body.plateNumber.trim();
    if (req.body.model !== undefined) v.model = req.body.model || "";
    if (req.body.notes !== undefined) v.notes = req.body.notes || "";
    await v.save();
    return res.json({ vehicle: v });
  }
);

garageRouter.delete("/vehicles/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await GarageVehicle.deleteOne({ _id: req.params.id, garageUserId: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

/** --- Saved estimates (line items → total) --- */
garageRouter.get("/estimates", async (req, res) => {
  const list = await GarageEstimate.find({ garageUserId: req.user._id }).sort({ updatedAt: -1 }).limit(100).lean();
  return res.json({ estimates: list });
});

garageRouter.post(
  "/estimates",
  [
    body("title").optional().isString().trim(),
    body("garageCustomerId").optional().isMongoId(),
    body("garageVehicleId").optional().isMongoId(),
    body("taxPercent").optional().isFloat({ min: 0, max: 100 }),
    body("lineItems").isArray({ min: 0 }),
    body("lineItems.*.kind").isIn(["service", "part"]),
    body("lineItems.*.description").isString().trim().notEmpty(),
    body("lineItems.*.quantity").isFloat({ min: 0.01 }),
    body("lineItems.*.unitPrice").isFloat({ min: 0 }),
    body("status").optional().isIn(["draft", "sent"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const taxPercent = req.body.taxPercent != null ? Number(req.body.taxPercent) : 0;
    const lineItems = (req.body.lineItems || []).map((x) => ({
      kind: x.kind,
      description: String(x.description).trim(),
      quantity: Number(x.quantity),
      unitPrice: Number(x.unitPrice),
    }));
    const { subtotal, tax, total } = computeLineItemsTotals(lineItems, taxPercent);
    const est = await GarageEstimate.create({
      garageUserId: req.user._id,
      garageCustomerId: req.body.garageCustomerId || undefined,
      garageVehicleId: req.body.garageVehicleId || undefined,
      title: req.body.title?.trim() || "",
      lineItems,
      taxPercent,
      subtotal,
      tax,
      total,
      status: req.body.status === "sent" ? "sent" : "draft",
    });
    return res.status(201).json({ estimate: est });
  }
);

garageRouter.patch(
  "/estimates/:id",
  [
    param("id").isMongoId(),
    body("title").optional().isString().trim(),
    body("taxPercent").optional().isFloat({ min: 0, max: 100 }),
    body("lineItems").optional().isArray({ min: 0 }),
    body("status").optional().isIn(["draft", "sent"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const est = await GarageEstimate.findOne({ _id: req.params.id, garageUserId: req.user._id });
    if (!est) return res.status(404).json({ error: "Not found" });
    if (est.status === "converted") return res.status(400).json({ error: "Estimate already converted to invoice" });
    if (req.body.title !== undefined) est.title = req.body.title;
    if (req.body.status !== undefined) est.status = req.body.status;
    if (req.body.taxPercent !== undefined) est.taxPercent = Number(req.body.taxPercent) || 0;
    if (req.body.lineItems) {
      est.lineItems = req.body.lineItems.map((x) => ({
        kind: x.kind,
        description: String(x.description).trim(),
        quantity: Number(x.quantity),
        unitPrice: Number(x.unitPrice),
      }));
      const t = computeLineItemsTotals(est.lineItems, est.taxPercent);
      est.subtotal = t.subtotal;
      est.tax = t.tax;
      est.total = t.total;
    } else if (req.body.taxPercent !== undefined) {
      const t = computeLineItemsTotals(est.lineItems, est.taxPercent);
      est.subtotal = t.subtotal;
      est.tax = t.tax;
      est.total = t.total;
    }
    await est.save();
    return res.json({ estimate: est });
  }
);

garageRouter.post("/estimates/:id/convert-invoice", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const est = await GarageEstimate.findOne({ _id: req.params.id, garageUserId: req.user._id });
  if (!est) return res.status(404).json({ error: "Not found" });
  if (est.status === "converted") return res.status(400).json({ error: "Already converted" });
  const lines = (est.lineItems || []).map((li) => {
    const amount = Math.round(li.quantity * li.unitPrice * 100) / 100;
    return {
      description: `${li.kind === "service" ? "[S] " : "[P] "}${li.description}`,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount,
    };
  });
  const inv = await GarageShopInvoice.create({
    garageUserId: req.user._id,
    number: nextShopInvoiceNumber(),
    garageCustomerId: est.garageCustomerId,
    garageVehicleId: est.garageVehicleId,
    estimateId: est._id,
    lines,
    subtotal: est.subtotal,
    tax: est.tax,
    total: est.total,
    paymentStatus: "pending",
  });
  est.status = "converted";
  est.shopInvoiceId = inv._id;
  await est.save();
  return res.status(201).json({ invoice: inv, estimate: est });
});

/** --- Shop invoices (garage CRM; not marketplace B2B Invoice) --- */
garageRouter.get("/shop-invoices", async (req, res) => {
  const invoices = await GarageShopInvoice.find({ garageUserId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  return res.json({ invoices });
});

garageRouter.patch(
  "/shop-invoices/:id/payment-status",
  [
    param("id").isMongoId(),
    body("paymentStatus").isIn(["pending", "partial", "paid"]),
    body("notes").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const inv = await GarageShopInvoice.findOne({ _id: req.params.id, garageUserId: req.user._id });
    if (!inv) return res.status(404).json({ error: "Not found" });
    inv.paymentStatus = req.body.paymentStatus;
    if (req.body.notes !== undefined) inv.notes = (inv.notes ? `${inv.notes}\n` : "") + (req.body.notes || "");
    await inv.save();
    return res.json({ invoice: inv });
  }
);

garageRouter.get("/shop-invoices/:id/share", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const inv = await GarageShopInvoice.findOne({ _id: req.params.id, garageUserId: req.user._id }).lean();
  if (!inv) return res.status(404).json({ error: "Not found" });
  const lines = (inv.lines || [])
    .map((l) => `• ${l.description} × ${l.quantity} @ ₹${l.unitPrice} = ₹${l.amount}`)
    .join("\n");
  const text = `Hornvin Garage — Invoice ${inv.number}\nStatus: ${inv.paymentStatus}\n\n${lines}\n\nSubtotal ₹${inv.subtotal}\nTax ₹${inv.tax}\nTotal ₹${inv.total}\n\nThank you for your business.`;
  return res.json({
    title: `Invoice ${inv.number}`,
    text,
    mimeHint: "text/plain",
    note: "Share as message or paste into WhatsApp. PDF export can be added with a print provider.",
  });
});

garageRouter.get("/customers/:customerId/automated-message", [param("customerId").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const c = await GarageCustomer.findOne({ _id: req.params.customerId, garageUserId: req.user._id });
  if (!c) return res.status(404).json({ error: "Not found" });
  const paymentDue = c.paymentReminderAt ? new Date(c.paymentReminderAt).toLocaleDateString() : "";
  const body = renderTemplate(c.automatedMessageTemplate || "Hi {{name}}, reminder from Hornvin Garage regarding {{plate}}. {{paymentDue}}", {
    name: c.name,
    plate: c.vehiclePlate || "",
    paymentDue: paymentDue ? `Payment note: ${paymentDue}` : "",
  });
  return res.json({ message: body });
});

garageRouter.get("/inventory/reorder-message", async (req, res) => {
  const low = await GarageInventoryItem.find({
    garageUserId: req.user._id,
    $expr: { $lte: ["$quantity", "$reorderAt"] },
    reorderAt: { $gt: 0 },
  })
    .sort({ name: 1 })
    .limit(30)
    .lean();
  if (!low.length) {
    return res.json({ message: "No low-stock SKUs right now.", items: [] });
  }
  const lines = low.map((i) => `• ${i.name} (${i.sku || "no SKU"}): qty ${i.quantity}, reorder at ${i.reorderAt} ${i.unit || "pcs"}`);
  const msg = `Reorder request — Hornvin Garage\n\nWe need the following from our distributor / supplier:\n\n${lines.join("\n")}\n\nPlease confirm availability and ETA.`;
  return res.json({ message: msg, items: low });
});

/** --- AI-assisted calling (template script; no external LLM required) --- */
garageRouter.post(
  "/ai-call-batch",
  [
    body("customerIds").isArray({ min: 1 }),
    body("customerIds.*").isMongoId(),
    body("purpose").isIn(["service_due", "offers"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const ids = req.body.customerIds;
    const customers = await GarageCustomer.find({ _id: { $in: ids }, garageUserId: req.user._id }).lean();
    const purpose = req.body.purpose;
    const items = customers.map((c) => {
      const vehicle = [c.vehicleModel, c.vehiclePlate].filter(Boolean).join(" — ");
      const script = buildCallScriptPurpose({
        customerName: c.name,
        vehicle,
        purpose: purpose === "offers" ? "offers" : "service_due",
      });
      return { customerId: String(c._id), name: c.name, phone: c.phone, script };
    });
    return res.json({ items });
  }
);

garageRouter.post(
  "/ai-call-script",
  [
    body("customerName").optional().isString().trim(),
    body("topic").optional().isString().trim(),
    body("vehicle").optional().isString().trim(),
    body("purpose").optional().isIn(["service_due", "offers", "custom"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const purpose = req.body.purpose || "custom";
    const script =
      purpose === "offers" || purpose === "service_due"
        ? buildCallScriptPurpose({
            customerName: req.body.customerName,
            vehicle: req.body.vehicle,
            purpose: purpose === "offers" ? "offers" : "service_due",
          })
        : buildCallScript({
            customerName: req.body.customerName,
            topic: req.body.topic,
            vehicle: req.body.vehicle,
          });
    return res.json({
      script,
      tips: [
        "Speak slowly; confirm identity before discussing vehicle details.",
        "Offer SMS/WhatsApp recap after the call.",
        "If the customer is driving, offer to call back.",
      ],
    });
  }
);

/** --- Work estimation (quick calculator; use /estimates to save line items) --- */
garageRouter.post(
  "/work-estimate",
  [
    body("laborHours").isFloat({ min: 0 }),
    body("laborRate").isFloat({ min: 0 }),
    body("partsCost").optional().isFloat({ min: 0 }),
    body("taxPercent").optional().isFloat({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const laborHours = Number(req.body.laborHours);
    const laborRate = Number(req.body.laborRate);
    const partsCost = req.body.partsCost != null ? Number(req.body.partsCost) : 0;
    const taxPercent = req.body.taxPercent != null ? Number(req.body.taxPercent) : 0;
    const laborSubtotal = Math.round(laborHours * laborRate * 100) / 100;
    const subtotal = Math.round((laborSubtotal + partsCost) * 100) / 100;
    const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    return res.json({
      laborSubtotal,
      partsCost,
      subtotal,
      taxPercent,
      tax,
      total,
    });
  }
);
