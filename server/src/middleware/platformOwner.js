/**
 * Super Admin = platform owner (company role + isPlatformOwner).
 */
export function requirePlatformOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "company" || !req.user.isPlatformOwner) {
    return res.status(403).json({
      error: "Super Admin (platform owner) only",
      code: "SUPER_ADMIN_ONLY",
    });
  }
  next();
}
