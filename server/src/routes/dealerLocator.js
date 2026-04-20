import { Router } from "express";
import { createLocationsRouter } from "./locations.js";
import { requireAuth } from "../middleware/auth.js";
import { nearbyDealersHandler, nearbyDealersValidators } from "./dealers.js";

/**
 * Dealer locator bundle: saved pins reuse the locations API; nearby uses geo on users.
 * Also available as /api/locations and /api/dealers/nearby for backwards compatibility.
 */
export const dealerLocatorRouter = Router();

dealerLocatorRouter.use("/locations", createLocationsRouter());

dealerLocatorRouter.get("/nearby", requireAuth(false), nearbyDealersValidators, nearbyDealersHandler);
