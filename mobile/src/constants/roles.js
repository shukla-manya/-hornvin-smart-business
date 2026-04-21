/** Roles aligned with server `USER_ROLES`. */
export const APP_ROLES = [
  {
    id: "company",
    label: "Hornvin company (Super Admin)",
    blurb: "Single platform root — only when server allows first-time Hornvin signup",
  },
  { id: "distributor", label: "Distributor", blurb: "Regional stock & downstream" },
  {
    id: "retail",
    label: "Garage (retail)",
    blurb: "Primary user — internal tools + marketplace (buy, sell, chat, suppliers)",
  },
  {
    id: "end_user",
    label: "End customer",
    blurb: "Light role — service (orders), pay, reminders; optional browse. Self-signup with email verify + sign-in OTP",
  },
];

/**
 * Public sign-up: distributor only via Super Admin.
 * End users (buyers) are approved without admin queue; email sign-ups verify inbox before a session is issued.
 * Retail may self-register (pending → Super Admin approval) or be created by distributor/admin (approved + must change password).
 */
/** Offline fallback: server injects Hornvin `company` only when root signup is open. */
export const SELF_SIGNUP_ROLES = APP_ROLES.filter((r) => r.id === "end_user" || r.id === "retail");

export function roleLabel(id) {
  return APP_ROLES.find((r) => r.id === id)?.label || id;
}
