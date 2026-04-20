import { Router } from "express";
import { query, validationResult } from "express-validator";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

export const nearbyDealersValidators = [
  query("lat").isFloat(),
  query("lng").isFloat(),
  query("role").optional().isIn(["distributor", "retail", "company"]),
];

export async function nearbyDealersHandler(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const role = req.query.role || "distributor";

  const dealers = await User.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceMeters",
        spherical: true,
        query: { role, location: { $exists: true, $ne: null } },
      },
    },
    { $limit: 50 },
    {
      $project: {
        passwordHash: 0,
      },
    },
  ]);

  return res.json({ dealers });
}

export const dealersRouter = Router();

dealersRouter.get("/nearby", requireAuth(false), nearbyDealersValidators, nearbyDealersHandler);
