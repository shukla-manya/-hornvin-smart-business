/** Allowed `User.garageServices` tags (retail onboarding + profile). */
export const GARAGE_SERVICE_IDS = [
  "general_repair",
  "oil_filters",
  "tyres",
  "ac",
  "electrical",
  "body_paint",
  "detailing",
  "diagnostics",
  "ev",
  "pickup_drop",
  "insurance_assist",
  "other",
];

const SET = new Set(GARAGE_SERVICE_IDS);

export function normalizeGarageServices(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || !SET.has(id)) continue;
    if (!out.includes(id)) out.push(id);
    if (out.length >= 12) break;
  }
  return out;
}

export function isValidGarageServicesArray(input) {
  return normalizeGarageServices(input).length > 0;
}
