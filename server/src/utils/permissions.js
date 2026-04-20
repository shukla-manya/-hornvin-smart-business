/**
 * Per-user flags controlled by Super Admin. Undefined / missing → allowed (backward compatible).
 */
export function canAddProducts(user) {
  if (user?.permissions?.canAddProducts === false) return false;
  return true;
}

export function canPlaceOrders(user) {
  if (user?.permissions?.canPlaceOrders === false) return false;
  return true;
}

export function canSell(user) {
  if (user?.permissions?.canSell === false) return false;
  return true;
}

/** Marketplace consumer / downstream buy — company (admin) accounts do not place these orders. */
export function canBeMarketplaceOrderBuyer(user) {
  if (!user?.role) return false;
  return user.role !== "company";
}

/** Upstream company-catalog replenishment — distributor and retail only (see RBAC matrix). */
export function canBeStockOrderBuyer(user) {
  const r = user?.role;
  return r === "distributor" || r === "retail";
}
