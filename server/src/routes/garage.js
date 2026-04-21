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
    const doc = await GarageServiceRecord.create({
      garageUserId: req.user._id,
      summary: req.body.summary,
      customerName: req.body.customerName || "",
      customerPhone: req.body.customerPhone || "",
      vehiclePlate: req.body.vehiclePlate || "",
      vehicleModel: req.body.vehicleModel || "",
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

/** --- AI-assisted calling (template script; no external LLM required) --- */
garageRouter.post(
  "/ai-call-script",
  [body("customerName").optional().isString().trim(), body("topic").optional().isString().trim(), body("vehicle").optional().isString().trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const script = buildCallScript({
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

/** --- Work estimation --- */
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
