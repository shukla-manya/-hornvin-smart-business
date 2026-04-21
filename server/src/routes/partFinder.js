import { Router } from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { buildProductListFilter } from "./products.js";
import { analyzePartImageWithOpenAI } from "../services/partFinderVision.js";

export const partFinderRouter = Router();

function toDataUrl(imageBase64, mimeType) {
  const raw = String(imageBase64 || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  const mime = (mimeType && String(mimeType).trim()) || "image/jpeg";
  return `data:${mime};base64,${raw}`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findProductsForQuery(searchQuery) {
  const q = String(searchQuery || "").trim().slice(0, 200);
  if (!q) return [];

  try {
    const filter = buildProductListFilter({ q });
    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(40)
      .populate("companyId", "businessName name role phone email")
      .populate("sellerId", "businessName name role phone email")
      .lean();
    if (products.length) return products;
  } catch {
    /* $text can throw on odd tokens */
  }

  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!tokens.length) return [];
  const rx = new RegExp(tokens.map(escapeRegex).join("|"), "i");
  return Product.find({
    $and: [
      { $or: [{ isGlobalCatalog: true }, { isGlobalCatalog: { $ne: true } }] },
      { $or: [{ name: rx }, { description: rx }, { category: rx }] },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(40)
    .populate("companyId", "businessName name role phone email")
    .populate("sellerId", "businessName name role phone email")
    .lean();
}

/** Collect seller user ids from listings (in stock). */
function sellerIdsFromProducts(products) {
  const ids = new Set();
  for (const p of products) {
    if ((p.quantity ?? 0) <= 0) continue;
    if (p.sellerId) ids.add(String(p.sellerId._id || p.sellerId));
  }
  return [...ids].filter(Boolean);
}

partFinderRouter.post(
  "/identify",
  requireAuth(true),
  [
    body("imageBase64").optional().isString(),
    body("mimeType").optional().isString().trim(),
    body("manualQuery").optional().isString().trim(),
    body("lat").optional().isFloat({ min: -90, max: 90 }),
    body("lng").optional().isFloat({ min: -180, max: 180 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const manualQuery = req.body.manualQuery ? String(req.body.manualQuery).trim() : "";
    const imageBase64 = req.body.imageBase64 ? String(req.body.imageBase64).trim() : "";
    const lat = req.body.lat != null ? Number(req.body.lat) : null;
    const lng = req.body.lng != null ? Number(req.body.lng) : null;

    if (!imageBase64 && !manualQuery) {
      return res.status(400).json({
        error: "Send a photo (imageBase64) or a text hint (manualQuery), or both.",
        code: "PART_FINDER_INPUT",
      });
    }

    let ai = false;
    let partSummary = "";
    let categoryHint = "";
    let searchQuery = manualQuery;

    if (imageBase64) {
      const approxBytes = Math.floor((imageBase64.length * 3) / 4);
      if (approxBytes > 6 * 1024 * 1024) {
        return res.status(400).json({ error: "Image too large (max ~6MB before encoding).", code: "PART_FINDER_IMAGE_TOO_LARGE" });
      }
      const dataUrl = toDataUrl(imageBase64, req.body.mimeType);
      if (!dataUrl) {
        return res.status(400).json({ error: "Invalid image payload.", code: "PART_FINDER_IMAGE" });
      }
      try {
        const vision = await analyzePartImageWithOpenAI(dataUrl);
        if (vision?.searchQuery) {
          ai = true;
          partSummary = vision.partSummary || "";
          categoryHint = vision.categoryHint || "";
          searchQuery = vision.searchQuery;
        } else if (!manualQuery) {
          return res.status(200).json({
            ai: false,
            partSummary: "",
            categoryHint: "",
            searchQuery: "",
            products: [],
            nearbySellers: [],
            message:
              "Photo received but vision is not configured. Set OPENAI_API_KEY on the server, or enter a text hint (manualQuery) and try again.",
            code: "PART_FINDER_NO_AI",
          });
        }
      } catch (e) {
        if (!manualQuery) {
          return res.status(502).json({
            error: e.message || "Vision service failed",
            code: "PART_FINDER_VISION_ERROR",
          });
        }
        searchQuery = manualQuery;
      }
    }

    if (!searchQuery?.trim()) {
      return res.status(400).json({ error: "Could not derive search keywords.", code: "PART_FINDER_NO_QUERY" });
    }

    const products = await findProductsForQuery(searchQuery);
    const sellerIdList = sellerIdsFromProducts(products)
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    let nearbySellers = [];
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) && sellerIdList.length) {
      try {
        nearbySellers = await User.aggregate([
          {
            $geoNear: {
              near: { type: "Point", coordinates: [lng, lat] },
              distanceField: "distanceMeters",
              spherical: true,
              query: {
                _id: { $in: sellerIdList },
                role: { $in: ["distributor", "retail", "company"] },
                status: "approved",
                location: { $exists: true, $ne: null },
              },
            },
          },
          { $limit: 25 },
          {
            $project: {
              passwordHash: 0,
            },
          },
        ]);
      } catch {
        nearbySellers = [];
      }
    }

    return res.json({
      ai,
      partSummary,
      categoryHint,
      searchQuery: searchQuery.trim(),
      products,
      nearbySellers,
      locationUsed: lat != null && lng != null,
    });
  }
);
