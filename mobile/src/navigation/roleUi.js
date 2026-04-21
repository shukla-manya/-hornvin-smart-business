/**
 * Role-based UI map for Hornvin Smart Business (single app, multiple personas).
 * Server roles: company | distributor | retail | end_user. Super Admin = sole Hornvin `company` + `isPlatformOwner`.
 */

export const MAIN_TAB_KEYS = {
  HOME: "HomeTab",
  GARAGE: "GarageTab",
  EXPLORE: "ExploreTab",
  CHAT: "ChatTab",
  ORDERS: "OrdersTab",
  NOTIFICATIONS: "NotificationsTab",
  PROFILE: "ProfileTab",
};

const BUSINESS_TABS = [
  MAIN_TAB_KEYS.HOME,
  MAIN_TAB_KEYS.EXPLORE,
  MAIN_TAB_KEYS.CHAT,
  MAIN_TAB_KEYS.ORDERS,
  MAIN_TAB_KEYS.PROFILE,
];

/** Retail: Garage operations tab + marketplace (Side 1 + Side 2 in one app). */
const RETAIL_TABS = [
  MAIN_TAB_KEYS.HOME,
  MAIN_TAB_KEYS.GARAGE,
  MAIN_TAB_KEYS.EXPLORE,
  MAIN_TAB_KEYS.CHAT,
  MAIN_TAB_KEYS.ORDERS,
  MAIN_TAB_KEYS.PROFILE,
];

/** End customer: light shell — service (orders), pay, reminders; optional marketplace from Home / Profile. */
const END_USER_TABS = [
  MAIN_TAB_KEYS.HOME,
  MAIN_TAB_KEYS.ORDERS,
  MAIN_TAB_KEYS.NOTIFICATIONS,
  MAIN_TAB_KEYS.PROFILE,
];

export function getVisibleMainTabKeys(role) {
  if (role === "end_user") return END_USER_TABS;
  if (role === "retail") return RETAIL_TABS;
  return BUSINESS_TABS;
}

/** Which tab is shown first after login (must be included in `getVisibleMainTabKeys`). */
export function getInitialMainTabKey(role) {
  const visible = getVisibleMainTabKeys(role);
  switch (role) {
    case "company":
    case "distributor":
      return MAIN_TAB_KEYS.HOME;
    case "retail":
      /** Primary persona: land on Home (command center for internal + external). */
      return MAIN_TAB_KEYS.HOME;
    case "end_user":
      return MAIN_TAB_KEYS.HOME;
    default:
      return visible[0] || MAIN_TAB_KEYS.HOME;
  }
}

const SUPER_ADMIN_STACK_ROUTES = new Set([
  "AdminHome",
  "AdminUsers",
  "AdminUserDetail",
  "AdminOrders",
  "AdminOrderDetail",
  "AdminPayments",
  "AdminCatalog",
  "AdminCategories",
  "AdminCoupons",
  "AdminPush",
  "AdminAnalytics",
  "AdminChatHub",
]);

const GARAGE_STACK_ROUTES = new Set([
  "GarageInventory",
  "GarageServiceHistory",
  "GarageReminders",
  "GarageAiCalling",
  "GarageWorkEstimate",
  "GarageVehicles",
  "GarageShopInvoices",
]);

const DISTRIBUTOR_STACK_ROUTES = new Set(["DistributorWorkspace", "DistributorInventory"]);

/** Stack routes that are not for every role (everything else is allowed when authenticated). */
export function userCanAccessStackRoute(user, routeName) {
  if (!user) return false;
  if (SUPER_ADMIN_STACK_ROUTES.has(routeName)) {
    return user.role === "company" && !!user.isPlatformOwner;
  }
  if (DISTRIBUTOR_STACK_ROUTES.has(routeName)) {
    return user.role === "distributor";
  }
  if (routeName === "PostProduct") {
    return user.role === "company" || user.role === "distributor" || user.role === "retail";
  }
  if (routeName === "Invoices") {
    return user.role === "company" || user.role === "distributor" || user.role === "retail";
  }
  if (GARAGE_STACK_ROUTES.has(routeName)) {
    return user.role === "retail";
  }
  return true;
}

/** Profile → deep links into the root stack. */
export function profileQuickLinkRoutes(user) {
  const links = [];
  if (user?.role === "end_user") {
    links.push({ nestedTab: "NotificationsTab", label: "Reminders" });
    links.push({ route: "Payments", label: "Payments" });
    links.push({ route: "MarketplaceBrowse", label: "Browse parts (optional)" });
    links.push({ route: "Rewards", label: "Coupons & rewards" });
    links.push({ route: "Locations", label: "Saved locations" });
    return links;
  }
  if (user?.role === "retail") {
    links.push({ nestedTab: "GarageTab", label: "Internal tools (garage)" });
    links.push({ route: "PostProduct", label: "Sell on marketplace" });
    links.push({ route: "MarketplaceBrowse", label: "Marketplace (buy from distributors)" });
    links.push({ route: "GarageServiceSelection", label: "Service focus (edit)", params: { edit: true } });
  }
  if (user?.role === "distributor") {
    links.push({ route: "DistributorWorkspace", label: "Distributor panel" });
    links.push({ route: "DistributorInventory", label: "My inventory & low stock" });
    links.push({ route: "CompanyCatalog", label: "Company catalog (stock orders)" });
    links.push({ route: "DealerMap", label: "Nearby garages", params: { initialRole: "retail" } });
  }
  if (user?.role === "company" && user?.isPlatformOwner) {
    links.push({ route: "AdminHome", label: "Hornvin Admin (/api/admin)" });
  }
  links.push({ route: "Rewards", label: "Coupons & rewards" });
  links.push({ route: "Wishlist", label: "Wishlist" });
  links.push({ route: "DealerMap", label: "Dealer locator" });
  links.push({ route: "Payments", label: "Payments" });
  links.push({ route: "Locations", label: "Saved locations" });
  links.push({ route: "Notifications", label: "Notifications" });
  return links;
}
