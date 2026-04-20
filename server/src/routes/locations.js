import { Router } from "express";
import { body, validationResult } from "express-validator";
import { Location } from "../models/Location.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

async function syncUserPrimaryGeo(userId) {
  const primary = await Location.findOne({ userId, isPrimary: true });
  const user = await User.findById(userId);
  if (!user) return;
  if (primary?.geo?.coordinates?.length === 2) {
    const [lng, lat] = primary.geo.coordinates;
    user.location = { type: "Point", coordinates: [lng, lat] };
  } else {
    user.set("location", undefined);
  }
  await user.save();
}

/** Fresh router instance so the same routes can be mounted under multiple base paths (e.g. dealer-locator). */
export function createLocationsRouter() {
  const locationsRouter = Router();
  locationsRouter.use(requireAuth(true));

  locationsRouter.get("/", async (req, res) => {
    const list = await Location.find({ userId: req.user._id }).sort({ isPrimary: -1, updatedAt: -1 });
    return res.json({ locations: list });
  });

  locationsRouter.post(
    "/",
    [
      body("label").isString().notEmpty(),
      body("lat").isFloat(),
      body("lng").isFloat(),
      body("address").optional().isString(),
      body("roleContext").optional().isString(),
      body("isPrimary").optional().isBoolean(),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { label, lat, lng, address, roleContext, isPrimary } = req.body;

      if (isPrimary) {
        await Location.updateMany({ userId: req.user._id }, { $set: { isPrimary: false } });
      }

      const loc = await Location.create({
        userId: req.user._id,
        label: label.trim(),
        address: address || "",
        geo: { type: "Point", coordinates: [lng, lat] },
        isPrimary: Boolean(isPrimary),
        roleContext: roleContext || "",
      });

      if (loc.isPrimary) await syncUserPrimaryGeo(req.user._id);

      return res.status(201).json({ location: loc });
    }
  );

  locationsRouter.patch(
    "/:id",
    [
      body("label").optional().isString(),
      body("address").optional().isString(),
      body("lat").optional().isFloat(),
      body("lng").optional().isFloat(),
      body("roleContext").optional().isString(),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const loc = await Location.findOne({ _id: req.params.id, userId: req.user._id });
      if (!loc) return res.status(404).json({ error: "Not found" });

      const { label, address, lat, lng, roleContext } = req.body;
      if (label !== undefined) loc.label = label.trim();
      if (address !== undefined) loc.address = address;
      if (roleContext !== undefined) loc.roleContext = roleContext;
      if (lat !== undefined && lng !== undefined) {
        loc.geo = { type: "Point", coordinates: [lng, lat] };
      }
      await loc.save();

      if (loc.isPrimary) await syncUserPrimaryGeo(req.user._id);

      return res.json({ location: loc });
    }
  );

  locationsRouter.patch("/:id/primary", async (req, res) => {
    const loc = await Location.findOne({ _id: req.params.id, userId: req.user._id });
    if (!loc) return res.status(404).json({ error: "Not found" });

    await Location.updateMany({ userId: req.user._id }, { $set: { isPrimary: false } });
    loc.isPrimary = true;
    await loc.save();
    await syncUserPrimaryGeo(req.user._id);

    return res.json({ location: loc });
  });

  locationsRouter.delete("/:id", async (req, res) => {
    const loc = await Location.findOne({ _id: req.params.id, userId: req.user._id });
    if (!loc) return res.status(404).json({ error: "Not found" });

    const wasPrimary = loc.isPrimary;
    await loc.deleteOne();

    if (wasPrimary) {
      const next = await Location.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
      if (next) {
        next.isPrimary = true;
        await next.save();
      }
      await syncUserPrimaryGeo(req.user._id);
    }

    return res.json({ ok: true });
  });

  return locationsRouter;
}

export const locationsRouter = createLocationsRouter();
