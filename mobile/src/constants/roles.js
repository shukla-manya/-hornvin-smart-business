/** Roles aligned with server `USER_ROLES`. */
export const APP_ROLES = [
  { id: "company", label: "Company", blurb: "Brand / manufacturer hub" },
  { id: "distributor", label: "Distributor", blurb: "Regional stock & downstream" },
  { id: "retail", label: "Retail / garage", blurb: "Shop or service point" },
  { id: "end_user", label: "End user", blurb: "Self-signup · email code to verify, then sign-in mail OTP" },
];

/**
 * Public sign-up: distributor only via Super Admin.
 * End users (buyers) are approved without admin queue; email sign-ups verify inbox before a session is issued.
 * Retail may self-register (pending → Super Admin approval) or be created by distributor/admin (approved + must change password).
 */
export const SELF_SIGNUP_ROLES = APP_ROLES.filter((r) => r.id === "company" || r.id === "end_user" || r.id === "retail");

export function roleLabel(id) {
  return APP_ROLES.find((r) => r.id === id)?.label || id;
}
