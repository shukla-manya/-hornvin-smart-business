/**
 * Hornvin Super Admin = the single `company` user with `isPlatformOwner` (only one root).
 * All `/api/admin/*` routes must pass this gate — global catalog, distributors, every garage, orders & analytics.
 */
export function isHornvinSuperAdmin(userDoc) {
  return Boolean(userDoc && userDoc.role === "company" && userDoc.isPlatformOwner);
}

export function requirePlatformOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (!isHornvinSuperAdmin(req.user)) {
    return res.status(403).json({
      error:
        "Only the Hornvin company (Super Admin) account may use /api/admin. There is exactly one: company role + platform owner flag.",
      code: "HORNVIN_SUPER_ADMIN_ONLY",
    });
  }
  next();
}
