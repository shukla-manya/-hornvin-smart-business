import { Router } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { emailTemporaryCredentials } from "../services/onboardingMail.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

export const usersRouter = Router();

usersRouter.use(requireAuth(true));

/**
 * Limited operational summary for distributors (not full platform analytics).
 * Super Admin full reports remain `GET /api/admin/analytics/summary`.
 */
usersRouter.get("/workspace-summary", allowRoles("distributor"), async (req, res) => {
  if (!req.user.companyId) {
    return res.status(400).json({ error: "Link to a company first (companyId missing)" });
  }
  const openStatuses = ["pending", "confirmed", "shipped"];
  const [retailLinkedCount, pendingApprovalCount, ordersOpenAsSeller, ordersOpenAsBuyer] = await Promise.all([
    User.countDocuments({ role: "retail", distributorId: req.user._id }),
    User.countDocuments({ role: "retail", status: "pending", distributorId: req.user._id }),
    Order.countDocuments({ sellerId: req.user._id, status: { $in: openStatuses } }),
    Order.countDocuments({ buyerId: req.user._id, status: { $in: openStatuses } }),
  ]);
  return res.json({
    retailLinkedCount,
    pendingApprovalCount,
    ordersOpenAsSeller,
    ordersOpenAsBuyer,
  });
});

/** Retailers linked to this distributor (manage downstream). */
usersRouter.get("/my-retail", allowRoles("distributor"), async (req, res) => {
  if (!req.user.companyId) {
    return res.status(400).json({ error: "Link to a company first (companyId missing)" });
  }
  const retail = await User.find({ role: "retail", distributorId: req.user._id })
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .lean();
  return res.json({ retail });
});

/**
 * Distributor creates a retail account under their branch (cannot create other distributors).
 * Super Admin creates distributors via `POST /api/admin/users/distributor`.
 */
usersRouter.post(
  "/retail",
  allowRoles("distributor"),
  [
    body("password").isLength({ min: 6 }),
    body("email").optional().isEmail(),
    body("phone").optional().isString(),
    body("name").optional().isString(),
    body("businessName").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!req.user.companyId) {
      return res.status(400).json({ error: "Link your distributor account to a company before adding retailers" });
    }

    const { email, phone, password, name, businessName } = req.body;
    if (!email && !phone) return res.status(400).json({ error: "email or phone required" });

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await User.create({
        email: email?.trim().toLowerCase() || undefined,
        phone: phone?.trim() || undefined,
        passwordHash,
        role: "retail",
        name,
        businessName,
        companyId: req.user.companyId,
        distributorId: req.user._id,
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
      return res.status(201).json({ user: user.toSafeJSON() });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Email or phone already in use" });
      return res.status(500).json({ error: "Create failed" });
    }
  }
);

usersRouter.get("/team", allowRoles("company"), async (req, res) => {
  const distributors = await User.find({ role: "distributor", companyId: req.user._id }).select(
    "-passwordHash"
  );
  const retail = await User.find({ role: "retail", companyId: req.user._id }).select("-passwordHash");
  return res.json({ distributors, retail });
});

usersRouter.patch("/link-distributor", allowRoles("distributor"), async (req, res) => {
  const { companyId } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId required" });
  const company = await User.findOne({ _id: companyId, role: "company" });
  if (!company) return res.status(404).json({ error: "Company not found" });
  req.user.companyId = company._id;
  await req.user.save();
  return res.json({ user: req.user.toSafeJSON() });
});

usersRouter.patch("/link-retail", allowRoles("retail"), async (req, res) => {
  const { distributorId } = req.body;
  if (!distributorId) return res.status(400).json({ error: "distributorId required" });
  const dist = await User.findOne({ _id: distributorId, role: "distributor" });
  if (!dist) return res.status(404).json({ error: "Distributor not found" });
  req.user.distributorId = dist._id;
  req.user.companyId = dist.companyId;
  await req.user.save();
  return res.json({ user: req.user.toSafeJSON() });
});
