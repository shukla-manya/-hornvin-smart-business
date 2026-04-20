import jwt from "jsonwebtoken";
import { User, getAccountAccessDenial } from "../models/User.js";

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const [type, token] = h.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export function requireAuth(required = true) {
  return async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) {
      if (required) return res.status(401).json({ error: "Unauthorized" });
      return next();
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) return res.status(401).json({ error: "Invalid token" });
      if (payload.role && payload.role !== user.role) {
        return res.status(401).json({ error: "Token outdated for this account" });
      }
      // Reject only if the token still claims platform owner but the account no longer does (demotion).
      // Allow DB user to be owner while JWT lags (e.g. promoted via seed) — admin checks use `req.user` from DB.
      if (payload.isPlatformOwner && !user.isPlatformOwner) {
        return res.status(401).json({ error: "Token outdated for this account" });
      }
      const denial = getAccountAccessDenial(user);
      if (denial) {
        return res.status(403).json(denial);
      }
      if (user.mustChangePassword) {
        const urlJoin = `${req.baseUrl || ""}${req.path || ""}`.replace(/\/{2,}/g, "/");
        const pathKey = `${req.method} ${urlJoin}`;
        const allowed =
          pathKey === "GET /api/auth/me" ||
          pathKey === "GET /api/auth/profile" ||
          pathKey === "PATCH /api/auth/profile" ||
          pathKey === "PATCH /api/auth/password" ||
          (req.method === "PATCH" && urlJoin.endsWith("/auth/password"));
        if (!allowed) {
          return res.status(403).json({
            error: "Change your password before continuing.",
            code: "MUST_CHANGE_PASSWORD",
          });
        }
      }
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

export function signToken(user) {
  const sub = user?.id || user?._id?.toString();
  if (!sub) throw new Error("Cannot sign token: user id missing");
  return jwt.sign(
    { sub, role: user.role, isPlatformOwner: !!user.isPlatformOwner },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}
