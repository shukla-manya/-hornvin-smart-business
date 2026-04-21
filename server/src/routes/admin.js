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
import { maybeNotifyStockLowAfterDecrease, sendPushToUsers } from "../services/pushNotify.js";
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
      { id: "dashboard", label: "Super Admin dashboard", paths: ["/admin/dashboard"] },
      { id: "user_detail", label: "User detail & activity", paths: ["/admin/users/:id"] },
      { id: "order_detail", label: "Order detail", paths: ["/admin/orders/:id"] },
    ],
  });
});

adminRouter.get("/dashboard", async (req, res) => {
  const companyId = req.user._id;
  const [
    totalGarages,
    totalDistributors,
    totalOrders,
    ordersByChannel,
    revenueRow,
    recentOrders,
    retailPending,
    activeUsers,
  ] = await Promise.all([
    User.countDocuments({ role: "retail", companyId }),
    User.countDocuments({ role: "distributor", companyId }),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: "$orderChannel", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .populate("buyerId", "name businessName role")
      .populate("sellerId", "name businessName role")
      .lean(),
    User.countDocuments({ role: "retail", companyId, status: "pending" }),
    User.countDocuments({
      $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }, { status: "" }],
    }),
  ]);
  const totalRevenue = revenueRow[0]?.total ?? 0;
  let ordersMarketplace = 0;
  let ordersStock = 0;
  for (const row of ordersByChannel) {
    const ch = row._id === "stock" ? "stock" : "marketplace";
    if (ch === "stock") ordersStock += row.count;
    else ordersMarketplace += row.count;
  }
  return res.json({
    totalGarages,
    totalDistributors,
    totalOrders,
    ordersMarketplace,
    ordersStock,
    totalRevenue,
    activeUsers,
    retailPendingApproval: retailPending,
    recentOrders,
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
    body("distributorRegion").optional().isString().trim().isLength({ max: 120 }),
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
    if (req.body.distributorRegion !== undefined) {
      if (user.role !== "distributor") {
        return res.status(400).json({ error: "Region applies only to distributor accounts", code: "REGION_DISTRIBUTOR_ONLY" });
      }
      const r = typeof req.body.distributorRegion === "string" ? req.body.distributorRegion.trim().slice(0, 120) : "";
      user.distributorRegion = r;
    }
    await user.save();
    return res.json({ user: safeUserDoc(user) });
  }
);

adminRouter.get(
  "/users/:id",
  [param("id").isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = await User.findById(req.params.id)
      .select("-passwordHash")
      .populate("companyId", "name businessName role phone email")
      .populate("distributorId", "name businessName role phone email distributorRegion")
      .populate("createdBy", "name email phone role businessName")
      .lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    const uid = user._id;
    const [ordersAsBuyer, ordersAsSeller, linkedGarages] = await Promise.all([
      Order.countDocuments({ buyerId: uid }),
      Order.countDocuments({ sellerId: uid }),
      user.role === "distributor" ? User.countDocuments({ distributorId: uid, role: "retail" }) : 0,
    ]);
    const recentActivity = await Order.find({ $or: [{ buyerId: uid }, { sellerId: uid }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("buyerId", "name businessName role")
      .populate("sellerId", "name businessName role")
      .lean();
    return res.json({
      user,
      stats: { ordersAsBuyer, ordersAsSeller, linkedGarages },
      recentActivity,
    });
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
    const { name, description, category, price, quantity, images, catalogHidden } = req.body;
    const prevQty = product.quantity;
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = price;
    if (quantity !== undefined) product.quantity = quantity;
    if (images !== undefined) product.images = images;
    if (catalogHidden !== undefined) product.catalogHidden = Boolean(catalogHidden);
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
  [
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("skip").optional().isInt({ min: 0 }),
    query("orderChannel").optional().isIn(["marketplace", "stock"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const filter = {};
    if (req.query.orderChannel) filter.orderChannel = req.query.orderChannel;
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("buyerId", "name businessName role phone email")
        .populate("sellerId", "name businessName role phone email")
        .populate("items.productId"),
      Order.countDocuments(filter),
    ]);
    return res.json({ orders, total, limit, skip });
  }
);

adminRouter.get("/orders/:id", [param("id").isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const order = await Order.findById(req.params.id)
    .populate("buyerId", "name businessName role phone email")
    .populate("sellerId", "name businessName role phone email")
    .populate("items.productId");
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ order });
});

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
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    revenueAgg,
    orderCounts,
    userCounts,
    productCount,
    trendAgg,
    topAgg,
    roleCounts,
    orderChannelAgg,
  ] = await Promise.all([
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
    Order.aggregate([
      { $match: { status: { $nin: ["cancelled"] }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: "$orderChannel", count: { $sum: 1 } } }]),
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue ?? 0;
  const activeUsers = await User.countDocuments({
    $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }, { status: "" }],
  });

  const topProductIds = topAgg.map((r) => r._id).filter(Boolean);
  const topDocs = topProductIds.length
    ? await Product.find({ _id: { $in: topProductIds } })
        .select("name category price")
        .lean()
    : [];
  const topById = new Map(topDocs.map((p) => [String(p._id), p]));
  const topProducts = topAgg.map((row) => {
    const p = topById.get(String(row._id));
    return {
      productId: row._id,
      name: p?.name || "Product",
      category: p?.category || "",
      units: row.units,
      revenue: row.revenue,
    };
  });

  const usersByRole = roleCounts.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
  const ordersByChannel = orderChannelAgg.reduce((acc, r) => {
    const k = r._id === "stock" ? "stock" : "marketplace";
    acc[k] = (acc[k] || 0) + r.count;
    return acc;
  }, {});

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
    salesTrend7d: trendAgg,
    topProducts,
    usersByRole,
    ordersByChannel,
  });
});

/** --- Coupons (points + optional discount label for promos) --- */

adminRouter.get("/coupons", async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ coupons });
});

adminRouter.post(
  "/coupons",
  [
    body("code").isString().trim().notEmpty(),
    body("title").optional().isString().trim(),
    body("pointsValue").optional().isFloat({ min: 0 }),
    body("discountPercent").optional().isFloat({ min: 0, max: 100 }),
    body("maxUses").optional().isInt({ min: 1 }),
    body("validUntil").optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const code = String(req.body.code).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    if (!code) return res.status(400).json({ error: "Invalid code" });
    try {
      const c = await Coupon.create({
        code,
        title: req.body.title?.trim() || "",
        pointsValue: req.body.pointsValue != null ? Number(req.body.pointsValue) : 100,
        discountPercent: req.body.discountPercent != null ? Number(req.body.discountPercent) : 0,
        maxUses: req.body.maxUses != null ? Number(req.body.maxUses) : 1000,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
        active: true,
        createdBy: req.user._id,
      });
      return res.status(201).json({ coupon: c });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Coupon code already exists" });
      throw e;
    }
  }
);

adminRouter.patch(
  "/coupons/:id",
  [
    param("id").isMongoId(),
    body("active").optional().isBoolean(),
    body("maxUses").optional().isInt({ min: 1 }),
    body("validUntil").optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const c = await Coupon.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (req.body.active !== undefined) c.active = req.body.active;
    if (req.body.maxUses !== undefined) c.maxUses = req.body.maxUses;
    if (req.body.validUntil !== undefined) {
      c.validUntil = req.body.validUntil ? new Date(req.body.validUntil) : undefined;
    }
    await c.save();
    return res.json({ coupon: c });
  }
);

/** --- Push broadcast (Expo) --- */

adminRouter.post(
  "/push/broadcast",
  [
    body("title").isString().trim().notEmpty(),
    body("body").isString().trim().notEmpty(),
    body("role").optional().isIn(USER_ROLES),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const filter = {
      $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }, { status: "" }],
    };
    if (req.body.role) filter.role = req.body.role;
    const users = await User.find(filter).select("_id").lean();
    const ids = users.map((u) => u._id);
    const pushResult = await sendPushToUsers(ids, {
      title: req.body.title.trim(),
      body: req.body.body.trim(),
      data: { type: "admin_broadcast" },
    });
    return res.json({ ok: true, audienceCount: ids.length, pushResult });
  }
);
