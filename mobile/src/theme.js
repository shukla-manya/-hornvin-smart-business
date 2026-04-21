/**
 * Vello design system — soft formal: warm neutrals, quiet depth, restrained accents.
 * Primary actions use muted burgundy; structure and links use cool slate steel.
 */
export const colors = {
  white: "#FFFFFF",
  /** Main screen background */
  background: "#F5F3EF",
  /** Cards and sheets */
  card: "#FFFFFF",
  border: "#E4DFD6",
  text: "#1A1715",
  textSecondary: "#64605C",

  /** Primary actions (sign in, submit) — muted, not loud */
  cta: "#8B3A3A",
  /** Nav headers, strong labels */
  header: "#2F3542",
  /** Links, tabs, selected chips — steel blue */
  secondaryBlue: "#4F6D8A",

  success: "#2F855A",
  warning: "#B8972E",
  error: "#B42318",
  info: "#3B6EA5",

  lightBlue: "#8FA8BF",
  softRed: "#D4A5A5",
  accentPurple: "#9B8FB8",

  chatSender: "#E6F4EC",
  chatReceiver: "#FFFFFF",

  disabled: "#DDD8D0",

  /** Hero / splash — slate mist */
  gradientStart: "#3B4554",
  gradientEnd: "#1F252E",

  /** Selected rows, chips, info panels */
  selectionBg: "#E9EEF4",
  selectionBorder: "#B9C5D4",
};

/** Soft elevation — diffuse, low contrast */
export const shadows = {
  card: {
    shadowColor: "#2F2A26",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
};

export const radii = {
  card: 18,
  input: 12,
  button: 14,
};

export function orderStatusStyle(status) {
  switch (status) {
    case "pending":
      return { bg: "#F8F1DC", text: "#6B5416", border: "#D9C47A" };
    case "confirmed":
      return { bg: "#E8EEF6", text: "#2C4A6E", border: colors.selectionBorder };
    case "shipped":
      return { bg: "#E6F4EC", text: "#1B5A3A", border: colors.success };
    case "completed":
      return { bg: "#E0F0E8", text: "#134A32", border: colors.success };
    case "cancelled":
      return { bg: "#F5E6E4", text: "#6B2E2A", border: colors.error };
    default:
      return { bg: colors.card, text: colors.textSecondary, border: colors.border };
  }
}

/** Product language: API uses `shipped`; users see “Delivered”. */
export function orderStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Processing";
    case "shipped":
      return "Out for delivery";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status ? String(status).replace("_", " ") : "—";
  }
}

/** Short CTA for the seller’s next transition (matches `NEXT_STATUS` in OrdersScreen). */
export function orderNextActionLabel(currentStatus) {
  switch (currentStatus) {
    case "pending":
      return "Accept";
    case "confirmed":
      return "Ship / dispatch";
    case "shipped":
      return "Mark completed";
    default:
      return "Update";
  }
}
