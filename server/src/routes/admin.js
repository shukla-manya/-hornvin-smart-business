import { Router } from "express";
import bcrypt from "bcryptjs";
import { body, param, query, validationResult } from "express-validator";
import { User, USER_ROLES, USER_STATUS } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { Category } from "../models/Category.js";
import { Coupon } from "../models/Coupon.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePlatformOwner } from "../middleware/platformOwner.js";
import { maybeNotifyStockLowAfterDecrease } from "../services/pushNotify.js";
import { sendPushToUsers } from "../services/pushNotify.js";
import { emailTemporaryCredentials } from "../services/onboardingMail.js";

/**
 * Hornvin Super Admin API (`/api/admin/*`).
 *
 * Only the single Hornvin `company` user (`isPlatformOwner`) may call these routes. They control:
 * - Global product catalog (`/catalog/products`, categories)
 * - Distributor creation (`/users/distributor` — always linked to this company)
 * - All garages / users (`/users`, `/users/retail`, PATCH user status — retail must use this company id)
 * - All orders, all payments, analytics summary
 */
export const adminRouter = Router();

adminRouter.use(requireAuth(true), requirePlatformOwner);

adminRouter.get("/platform", (_req, res) => {
  return res.json({
    identity: "hornvin_company_super_admin",
    singleRoot: true,
    adminApiPrefix: "/api/admin",
    controls: [
      { id: "global_catalog", label: "Global product catalog", paths: ["/admin/catalog/products", "/admin/categories"] },
      { id: "distributors", label: "Create & link distributors", paths: ["/admin/users/distributor"] },
      { id: "garages", label: "All garages (retail) & user moderation", paths: ["/admin/users", "/admin/users/retail"] },
      { id: "commerce", label: "All orders & payments", paths: ["/admin/orders", "/admin/payments"] },
      { id: "analytics", label: "Platform analytics", paths: ["/admin/analytics/summary"] },
      { id: "coupons", label: "Coupons & rewards", paths: ["/admin/coupons"] },
      { id: "push", label: "Push broadcasts", paths: ["/admin/push/broadcast"] },
    ],
  });
});

function safeUserDoc(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  delete o.passwordHash;
  return o;
}

/** --- User management --- */

adminRouter.get(
  "/users",
  [
    query("role").optional().isIn(USER_ROLES),
    query("status").optional().isIn(USER_STATUS),
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("skip").optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;

    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-passwordHash")
        .populate("createdBy", "name email phone role businessName")
        .lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ users, total, limit, skip });
  }
);

adminRouter.post(
  "/users/distributor",
  [
    body("password").isLength({ min: 6 }),
    body("name").optional().isString(),
    body("businessName").optional().isString(),
    body("email").optional().isEmail(),
    body("phone").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, phone, password, name, businessName } = req.body;
    if (!email && !phone) return res.status(400).json({ error: "email or phone required" });

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await User.create({
        email: email?.trim().toLowerCase() || undefined,
        phone: phone?.trim() || undefined,
        passwordHash,
        role: "distributor",
        name,
        businessName,
        companyId: req.user._id,
        status: "approved",
        mustChangePassword: true,
        permissions: { canAddProducts: true, canPlaceOrders: true, canSell: true },
        createdBy: req.user._id,
      });
      if (email) {
        const em = email.trim().toLowerCase();
        await emailTemporaryCredentials(em, {
          roleTitle: "distributor",
          loginLine: `Sign in with email: ${em}`,
          temporaryPassword: password,
          name,
        });
      }
      return res.status(201).json({ user: safeUserDoc(user) });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Email or phone already in use" });
      return res.status(500).json({ error: "Create failed" });
    }
  }
);

adminRouter.post(
  "/users/retail",
  [
    body("password").isLength({ min: 6 }),
    body("companyId").isMongoId(),
    body("distributorId").isMongoId(),
    body("email").optional().isEmail(),
    body("phone").optional().isString(),
    body("name").optional().isString(),
    body("businessName").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, phone, password, name, businessName, companyId, distributorId } = req.body;
    if (!email && !phone) return res.status(400).json({ error: "email or phone required" });

    if (String(companyId) !== String(req.user._id)) {
      return res.status(403).json({
        code: "ADMIN_RETAIL_MUST_USE_HORNVIN_COMPANY",
        error:
          "Super Admin may only create garages under the Hornvin company (your account). companyId must match your user id.",
      });
    }

    const dist = await User.findOne({
      _id: distributorId,
      role: "distributor",
      companyId: req.user._id,
    });
    if (!dist) {
      return res.status(400).json({ error: "Distributor not found under your Hornvin company" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await User.create({
        email: email?.trim().toLowerCase() || undefined,
        phone: phone?.trim() || undefined,
        passwordHash,
        role: "retail",
        name,
        businessName,
        companyId,
        distributorId,
        status: "approved",
        mustChangePassword: true,
        permissions: { canAddProducts: true, canPlaceOrders: true, canSell: true },
        createdBy: req.user._id,
      });
      if (email) {
        const em = email.trim().toLowerCase();
        await emailTemporaryCredentials(em, {
          roleTitle: "retail / garage",
          loginLine: `Sign in with email: ${em}`,
          temporaryPassword: password,
          name: name || businessName,
        });
      }
      return res.status(201).json({ user: safeUserDoc(user) });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Email or phone already in use" });
      return res.status(500).json({ error: "Create failed" });
    }
  }
);

adminRouter.patch(
  "/users/:id",
  [
    param("id").isMongoId(),
    body("status").optional().isIn(USER_STATUS),
    body("permissions").optional().isObject(),
    body("permissions.canAddProducts").optional().isBoolean(),
    body("permissions.canPlaceOrders").optional().isBoolean(),
    body("permissions.canSell").optional().isBoolean(),
    body("name").optional().isString().trim().isLength({ min: 0, max: 120 }),
    body("businessName").optional().isString().trim().isLength({ min: 0, max: 200 }),
    body("address").optional().isString().trim().isLength({ min: 0, max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isPlatformOwner && req.body.status && req.body.status !== "approved") {
      return res.status(400).json({ error: "Cannot change status of the platform owner" });
    }

    if (req.body.status !== undefined) user.status = req.body.status;
    if (req.body.permissions) {
      const p = req.body.permissions;
      const cur = user.permissions || {};
      user.set("permissions", {
        canAddProducts: p.canAddProducts !== undefined ? p.canAddProducts : cur.canAddProducts !== false,
        canPlaceOrders: p.canPlaceOrders !== undefined ? p.canPlaceOrders : cur.canPlaceOrders !== false,
        canSell: p.canSell !== undefined ? p.canSell : cur.canSell !== false,
      });
    }
    if (req.body.name !== undefined) {
      const n = typeof req.body.name === "string" ? req.body.name.trim() : "";
      user.name = n || undefined;
    }
    if (req.body.businessName !== undefined) {
      const b = typeof req.body.businessName === "string" ? req.body.businessName.trim() : "";
      user.businessName = b || undefined;
    }
    if (req.body.address !== undefined) {
      const a = typeof req.body.address === "string" ? req.body.address.trim() : "";
      user.address = a || undefined;
    }
    await user.save();
    return res.json({ user: safeUserDoc(user) });
  }
);

/** --- Global catalog (products) --- */

adminRouter.get("/catalog/products", async (req, res) => {
  const products = await Product.find({ isGlobalCatalog: true, sellerId: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return res.json({ products });
});

adminRouter.post(
  "/catalog/products",
  [
    body("name").isString().notEmpty(),
    body("category").isString().notEmpty(),
    body("price").isFloat({ min: 0 }),
    body("quantity").isInt({ min: 0 }),
    body("description").optional().isString(),
    body("images").optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const ownerId = req.user._id;
    const product = await Product.create({
      companyId: ownerId,
      sellerId: ownerId,
      name: req.body.name,
      description: req.body.description || "",
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
      images: req.body.images || [],
      isGlobalCatalog: true,
    });
    const populated = await Product.findById(product._id)
      .populate("companyId", "businessName name role phone email")
      .populate("sellerId", "businessName name role phone email");
    return res.status(201).json({ product: populated });
  }
);

adminRouter.patch(
  "/catalog/products/:id",
  [param("id").isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Not found" });
    if (!product.isGlobalCatalog || !product.sellerId.equals(req.user._id)) {
      return res.status(403).json({ error: "Only global catalog products you own can be edited here" });
    }
    const { name, description, category, price, quantity, images } = req.body;
    const prevQty = product.quantity;
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = price;
    if (quantity !== undefined) product.quantity = quantity;
    if (images !== undefined) product.images = images;
    await product.save();
    if (quantity !== undefined) void maybeNotifyStockLowAfterDecrease(product, prevQty).catch(() => {});
    const populated = await Product.findById(product._id)
      .populate("companyId", "businessName name role phone email")
      .populate("sellerId", "businessName name role phone email");
    return res.json({ product: populated });
  }
);

adminRouter.delete("/catalog/products/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  if (!product.isGlobalCatalog || !product.sellerId.equals(req.user._id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await product.deleteOne();
  return res.json({ ok: true });
});

/** --- Categories --- */

adminRouter.get("/categories", async (_req, res) => {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
  return res.json({ categories });
});

adminRouter.post(
  "/categories",
  [body("name").isString().trim().notEmpty(), body("sortOrder").optional().isInt()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const c = await Category.create({
        name: req.body.name.trim(),
        sortOrder: req.body.sortOrder ?? 0,
        active: true,
      });
      return res.status(201).json({ category: c });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Category name exists" });
      throw e;
    }
  }
);

adminRouter.patch(
  "/categories/:id",
  [
    param("id").isMongoId(),
    body("name").optional().isString().trim().notEmpty(),
    body("sortOrder").optional().isInt(),
    body("active").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const c = await Category.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (req.body.name !== undefined) c.name = req.body.name.trim();
    if (req.body.sortOrder !== undefined) c.sortOrder = req.body.sortOrder;
    if (req.body.active !== undefined) c.active = req.body.active;
    await c.save();
    return res.json({ category: c });
  }
);

adminRouter.delete("/categories/:id", [param("id").isMongoId()], async (req, res) => {
  const c = await Category.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

/** --- Orders (all) --- */

adminRouter.get(
  "/orders",
  [query("limit").optional().isInt({ min: 1, max: 200 }), query("skip").optional().isInt({ min: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const [orders, total] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("buyerId", "name businessName role phone email")
        .populate("sellerId", "name businessName role phone email")
        .populate("items.productId"),
      Order.countDocuments(),
    ]);
    return res.json({ orders, total, limit, skip });
  }
);

/** --- Payments (transactions overview) --- */

adminRouter.get(
  "/payments",
  [query("limit").optional().isInt({ min: 1, max: 200 }), query("skip").optional().isInt({ min: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const [payments, total] = await Promise.all([
      Payment.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("payerId", "name businessName role phone email")
        .populate("payeeId", "name businessName role phone email")
        .populate("orderId")
        .populate("invoiceId"),
      Payment.countDocuments(),
    ]);
    return res.json({ payments, total, limit, skip });
  }
);

/** --- Analytics --- */

adminRouter.get("/analytics/summary", async (_req, res) => {
  const [revenueAgg, orderCounts, userCounts, productCount] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Product.countDocuments(),
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue ?? 0;
  const activeUsers = await User.countDocuments({
    $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }, { status: "" }],
  });

  return res.json({
    totalRevenue,
    orderCountByStatus: orderCounts.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {}),
    userCountByStatus: userCounts.reduce((acc, r) => {
      acc[r._id || "unknown"] = r.count;
      return acc;
    }, {}),
    activeUsers,
    productCount,
  });
});
