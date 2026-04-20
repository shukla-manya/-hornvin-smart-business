import { Router } from "express";
import { body, query, validationResult } from "express-validator";
import { Product } from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { maybeNotifyStockLowAfterDecrease } from "../services/pushNotify.js";
import { canAddProducts, canSell } from "../utils/permissions.js";

export const productsRouter = Router();

/** Marketplace list: global catalog + normal listings; scoped by seller/company excludes global-only OR. */
function buildProductListFilter(query) {
  const category = query.category;
  const companyId = query.companyId;
  const sellerId = query.sellerId;
  const q = query.q;

  const scoped = Boolean(sellerId || companyId);
  const parts = [];
  if (category) parts.push({ category });
  if (companyId) parts.push({ companyId });
  if (sellerId) parts.push({ sellerId });
  if (q) parts.push({ $text: { $search: String(q) } });

  if (scoped) {
    if (parts.length === 0) return {};
    return parts.length === 1 ? parts[0] : { $and: parts };
  }

  const globalParts = [{ isGlobalCatalog: true }];
  if (category) globalParts.push({ category });
  if (q) globalParts.push({ $text: { $search: String(q) } });
  const globalFilter = globalParts.length === 1 ? globalParts[0] : { $and: globalParts };

  const restParts = [{ isGlobalCatalog: { $ne: true } }];
  if (category) restParts.push({ category });
  if (q) restParts.push({ $text: { $search: String(q) } });
  const restFilter = restParts.length === 1 ? restParts[0] : { $and: restParts };

  return { $or: [globalFilter, restFilter] };
}

function canManageProduct(user, product) {
  const sid = product.sellerId || product.companyId;
  return sid && sid.equals(user._id);
}

productsRouter.get(
  "/",
  [
    query("q").optional().isString(),
    query("category").optional().isString(),
    query("companyId").optional().isMongoId(),
    query("sellerId").optional().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const filter = buildProductListFilter(req.query);
    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("companyId", "businessName name role phone email")
      .populate("sellerId", "businessName name role phone email");
    return res.json({ products });
  }
);

productsRouter.get("/:id", async (req, res) => {
  const p = await Product.findById(req.params.id)
    .populate("companyId", "businessName name role phone email")
    .populate("sellerId", "businessName name role phone email");
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json({ product: p });
});

productsRouter.use(requireAuth(true));

productsRouter.post(
  "/",
  allowRoles("company", "distributor"),
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

    if (!canAddProducts(req.user)) {
      return res.status(403).json({ error: "You are not allowed to add products" });
    }
    if ((req.user.role === "company" || req.user.role === "distributor") && !canSell(req.user)) {
      return res.status(403).json({ error: "You are not allowed to sell listings" });
    }

    let companyId;
    let sellerId = req.user._id;

    if (req.user.role === "company") {
      companyId = req.user._id;
    } else {
      if (!req.user.companyId) {
        return res.status(400).json({ error: "Link your distributor account to a company before listing products" });
      }
      companyId = req.user.companyId;
    }

    const product = await Product.create({
      companyId,
      sellerId,
      name: req.body.name,
      description: req.body.description || "",
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
      images: req.body.images || [],
      isGlobalCatalog: false,
    });
    const populated = await Product.findById(product._id)
      .populate("companyId", "businessName name role phone email")
      .populate("sellerId", "businessName name role phone email");
    return res.status(201).json({ product: populated });
  }
);

productsRouter.patch("/:id", allowRoles("company", "distributor"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  if (!canAddProducts(req.user)) {
    return res.status(403).json({ error: "You are not allowed to edit products" });
  }
  if (!canManageProduct(req.user, product)) {
    return res.status(403).json({ error: "Not your product" });
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
  if (quantity !== undefined) {
    void maybeNotifyStockLowAfterDecrease(product, prevQty).catch(() => {});
  }
  const populated = await Product.findById(product._id)
    .populate("companyId", "businessName name role phone email")
    .populate("sellerId", "businessName name role phone email");
  return res.json({ product: populated });
});

productsRouter.delete("/:id", allowRoles("company", "distributor"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  if (!canAddProducts(req.user)) {
    return res.status(403).json({ error: "You are not allowed to delete products" });
  }
  if (!canManageProduct(req.user, product)) {
    return res.status(403).json({ error: "Not your product" });
  }
  await product.deleteOne();
  return res.json({ ok: true });
});
