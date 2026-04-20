import { useState, useEffect } from "react";
import { authApi } from "../api/resources";
import { SELF_SIGNUP_ROLES, APP_ROLES } from "../constants/roles";

function withBlurbs(registerable) {
  return registerable.map((r) => ({
    id: r.id,
    label: r.label,
    blurb: APP_ROLES.find((a) => a.id === r.id)?.blurb || "",
  }));
}

/**
 * Roles the server currently allows on `POST /auth/register` (mirrors REGISTER_ALLOWED_ROLES + distributor rule).
 * Falls back to local `SELF_SIGNUP_ROLES` if the API is unreachable.
 */
export function useRegisterableRoles() {
  const [roles, setRoles] = useState(SELF_SIGNUP_ROLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.roles();
        const raw = data.registerableRoles;
        if (!cancelled && Array.isArray(raw) && raw.length > 0) {
          setRoles(withBlurbs(raw));
        }
      } catch {
        if (!cancelled) setRoles(SELF_SIGNUP_ROLES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { registerableRoles: roles, loading };
}
