/**
 * Single Hornvin root: `company` role is the only Super Admin (`isPlatformOwner` must be true).
 */
export function requirePlatformOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "company" || !req.user.isPlatformOwner) {
    return res.status(403).json({
      error: "Hornvin company (Super Admin) only",
      code: "SUPER_ADMIN_ONLY",
    });
  }
  next();
}
