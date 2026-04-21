import { Router } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { User, USER_ROLES, isUserApproved, getAccountAccessDenial } from "../models/User.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import {
  createAndEmailOtp,
  createPhoneLoginOtp,
  phoneOtpStorageKey,
  verifyOtpCode,
  allowOtpRequest,
} from "../services/otpEmail.js";

export const authRouter = Router();

export function rolePublicLabel(id) {
  if (id === "company") return "Hornvin company (Super Admin)";
  if (id === "distributor") return "Distributor";
  if (id === "retail") return "Retail / Garage";
  if (id === "end_user") return "End user";
  return id;
}

/**
 * Roles that may use `POST /api/auth/register` with current env policy
 * (`REGISTER_ALLOWED_ROLES`, `ALLOW_DOWNSTREAM_SELF_REGISTER`).
 */
export function computeRegisterableRoleIds() {
  const downstream = process.env.ALLOW_DOWNSTREAM_SELF_REGISTER === "1";
  const csv = (process.env.REGISTER_ALLOWED_ROLES || "").trim();
  const allowedList = csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : null;

  return USER_ROLES.filter((role) => {
    /** Sole root: `company` is never generic self-serve; `/roles` may inject it when bootstrap + no root yet. */
    if (role === "company") return false;
    if (role === "distributor" && !downstream) return false;
    if (allowedList && allowedList.length > 0 && !allowedList.includes(role)) return false;
    return true;
  });
}

/** Buyers (`end_user`) who registered with email must verify inbox before receiving a JWT. */
function needsEmailVerificationGate(user) {
  return user.role === "end_user" && user.email && user.emailVerified === false;
}

authRouter.get("/roles", async (_req, res) => {
  try {
    const registerableIds = computeRegisterableRoleIds();
    const allowedCsv = (process.env.REGISTER_ALLOWED_ROLES || "").trim();
    const allowedList = allowedCsv ? allowedCsv.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const bootstrapEmail = (process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || "").trim().toLowerCase();
    const companyRootExists = await User.exists({ role: "company" });
    const hornvinRootSignupOpen = !companyRootExists && Boolean(bootstrapEmail);

    let finalIds = registerableIds;
    if (hornvinRootSignupOpen) {
      const canOfferCompany = !allowedList || allowedList.includes("company");
      if (canOfferCompany && !finalIds.includes("company")) {
        finalIds = ["company", ...finalIds];
      }
    }

    return res.json({
      roles: USER_ROLES.map((id) => ({ id, label: rolePublicLabel(id) })),
      registerableRoles: finalIds.map((id) => ({ id, label: rolePublicLabel(id) })),
      policy: {
        registerAllowedRolesEnvSet: Boolean(allowedCsv),
        distributorSelfRegisterAllowed: process.env.ALLOW_DOWNSTREAM_SELF_REGISTER === "1",
        companyRootExists: !!companyRootExists,
        hornvinRootSignupOpen,
      },
    });
  } catch {
    return res.status(500).json({ error: "Could not load roles" });
  }
});

authRouter.post(
  "/register",
  [
    body("password").isLength({ min: 6 }),
    body("role").isIn(USER_ROLES),
    body("email").optional().isEmail(),
    body("phone").optional().isString(),
    body("companyId").optional().isMongoId(),
    body("distributorId").optional().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, phone, password, role, name, businessName, address, companyId, distributorId } =
      req.body;

    const businessTrim = typeof businessName === "string" ? businessName.trim() : "";
    if (!businessTrim) {
      return res.status(400).json({
        code: "BUSINESS_NAME_REQUIRED",
        error: "Business name is required.",
      });
    }
    if (businessTrim.length > 200) {
      return res.status(400).json({ error: "Business name must be at most 200 characters." });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: "email or phone required" });
    }

    const emailNorm = email ? email.trim().toLowerCase() : "";
    const phoneTrim = phone ? String(phone).trim() : "";
    const phoneDigits = phoneTrim.replace(/\D/g, "");
    if (emailNorm && phoneDigits.length < 8) {
      return res.status(400).json({
        code: "PHONE_REQUIRED_WITH_EMAIL",
        error: "When signing up with email, add a valid mobile number (used for sign-in codes).",
      });
    }

    const allowedCsv = (process.env.REGISTER_ALLOWED_ROLES || "").trim();
    if (allowedCsv) {
      const allowed = allowedCsv.split(",").map((s) => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(role)) {
        return res.status(403).json({
          code: "REGISTER_ROLE_NOT_ALLOWED",
          error: "This role cannot self-register. Use an invite or ask your administrator.",
        });
      }
    }

    if (role === "distributor" && process.env.ALLOW_DOWNSTREAM_SELF_REGISTER !== "1") {
      return res.status(403).json({
        error: "Distributor accounts are created only by the platform Super Admin.",
        code: "ROLE_NOT_SELF_SIGNUP",
      });
    }

    if (role === "company") {
      if (!emailNorm) {
        return res.status(400).json({
          code: "COMPANY_REQUIRES_EMAIL",
          error: "The Hornvin company (Super Admin) account must be created with email (no phone-only sign-up).",
        });
      }
      if (await User.exists({ role: "company" })) {
        return res.status(403).json({
          code: "PLATFORM_ROOT_EXISTS",
          error: "A Hornvin company / Super Admin account already exists. There can only be one root company.",
        });
      }
      const bootstrapEmail = (process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || "").trim().toLowerCase();
      if (!bootstrapEmail || emailNorm !== bootstrapEmail) {
        return res.status(403).json({
          code: "COMPANY_REGISTER_BOOTSTRAP_EMAIL_ONLY",
          error:
            "Only the email configured as BOOTSTRAP_PLATFORM_OWNER_EMAIL on the server may create the sole Hornvin company (Super Admin) account.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isPlatformOwner = role === "company";

    const skipApproval = process.env.SKIP_USER_APPROVAL === "1";
    /** Self-serve retail / garage: always pending until Super Admin approves (even in dev skip mode). */
    /** End users (buyers): always approved — no admin queue; email self-signups verify inbox via OTP before a JWT is issued. */
    const status =
      role === "retail"
        ? "pending"
        : role === "end_user"
          ? "approved"
          : skipApproval || isPlatformOwner
            ? "approved"
            : "pending";

    const emailVerified = role === "end_user" && emailNorm ? false : true;

    try {
      const user = await User.create({
        email: emailNorm || undefined,
        phone: phoneTrim || undefined,
        passwordHash,
        role,
        name,
        businessName: businessTrim,
        address,
        companyId: companyId || undefined,
        distributorId: distributorId || undefined,
        isPlatformOwner,
        status,
        emailVerified,
      });
      if (role === "end_user" && emailNorm) {
        try {
          const otpSend = await createAndEmailOtp(emailNorm, "register_email_verify");
          const payload = {
            needsEmailVerification: true,
            user: user.toSafeJSON(),
            message: "Enter the 6-digit code we emailed to finish sign-up.",
          };
          if (process.env.NODE_ENV === "test" && otpSend.devCode) {
            payload._testOnlyEmailCode = otpSend.devCode;
          }
          return res.status(201).json(payload);
        } catch (e) {
          return res.status(503).json({ error: e.message || "Could not send verification email" });
        }
      }
      if (!isUserApproved(user)) {
        return res.status(201).json({ user: user.toSafeJSON(), pendingApproval: true });
      }
      const token = signToken(user);
      return res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: "Email or phone already registered" });
      }
      return res.status(500).json({ error: "Registration failed" });
    }
  }
);

authRouter.post(
  "/login",
  [
    body("password").isString(),
    body("email").optional().isEmail(),
    body("phone").optional().isString(),
    body("otpCode").optional().isString(),
    body("emailOtp").optional().isString(),
    body("phoneOtp").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, phone, password, otpCode, emailOtp: emailOtpRaw, phoneOtp: phoneOtpRaw } = req.body;
    const emailOtp = emailOtpRaw ?? otpCode;
    const phoneOtp = phoneOtpRaw;
    if (!email && !phone) return res.status(400).json({ error: "email or phone required" });

    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const denial = getAccountAccessDenial(user);
    if (denial) return res.status(403).json(denial);

    if (needsEmailVerificationGate(user)) {
      return res.status(403).json({
        error:
          "Verify your email with the code we sent at registration (or use Resend on the sign-up screen), then sign in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    /**
     * Email + password: second factor via **email OTP + phone OTP** (phone codes are logged on the API terminal until SMS is wired).
     * Platform Super Admin (`isPlatformOwner`) uses password only.
     * Accounts with `mustChangePassword` skip OTP so first sign-in goes to the forced password change screen.
     */
    if (email && user.email && !user.isPlatformOwner && !user.mustChangePassword) {
      const phoneOk = user.phone && String(user.phone).trim();
      const phoneKey = phoneOk ? phoneOtpStorageKey(user.phone) : null;
      if (!phoneKey) {
        return res.status(400).json({
          code: "PHONE_REQUIRED_FOR_EMAIL_LOGIN",
          error:
            "This account signs in with email but has no mobile on file. Ask your administrator to add a phone number, or register with email and mobile together.",
        });
      }

      if (!emailOtp || !phoneOtp) {
        if (!allowOtpRequest(`login-pw:${email}`)) {
          return res.status(429).json({ error: "Please wait before requesting another code" });
        }
        try {
          const sentEmail = await createAndEmailOtp(email, "login_email_step");
          const sentPhone = await createPhoneLoginOtp(user.phone, "login_phone_step");
          const out = {
            needsOtp: true,
            needsEmailOtp: true,
            needsPhoneOtp: true,
            message: "Enter the 6-digit codes sent to your email and to your phone (phone code is also printed in the API server terminal for now).",
          };
          if (process.env.NODE_ENV === "test") {
            if (sentEmail.devCode) out._testOnlyEmailCode = sentEmail.devCode;
            if (sentPhone.devCode) out._testOnlyPhoneCode = sentPhone.devCode;
          }
          return res.json(out);
        } catch (e) {
          return res.status(503).json({ error: e.message || "Could not send verification codes" });
        }
      }

      const ve = await verifyOtpCode(email, "login_email_step", emailOtp);
      if (!ve.ok) return res.status(401).json({ error: ve.error || "Invalid email code" });
      const vp = await verifyOtpCode(phoneKey, "login_phone_step", phoneOtp);
      if (!vp.ok) return res.status(401).json({ error: vp.error || "Invalid phone code" });
    }

    const token = signToken(user);
    return res.json({ token, user: user.toSafeJSON() });
  }
);

authRouter.patch(
  "/password",
  requireAuth(true),
  [body("currentPassword").isString(), body("newPassword").isLength({ min: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { currentPassword, newPassword } = req.body;
    const ok = await req.user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    req.user.mustChangePassword = false;
    await req.user.save();
    return res.json({ user: req.user.toSafeJSON(), ok: true });
  }
);

authRouter.post("/login-otp/request", [body("email").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const email = req.body.email.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ ok: true, message: "If an account exists, a code was sent." });
  }
  if (getAccountAccessDenial(user)) {
    return res.json({ ok: true, message: "If an account exists, a code was sent." });
  }
  if (!allowOtpRequest(`login-otp:${email}`)) {
    return res.status(429).json({ error: "Please wait before requesting another code" });
  }
  try {
    await createAndEmailOtp(email, "login_email_otp_only");
  } catch (e) {
    return res.status(503).json({ error: e.message || "Could not send email" });
  }
  return res.json({ ok: true, message: "If an account exists, a code was sent." });
});

authRouter.post(
  "/login-otp/verify",
  [body("email").isEmail(), body("code").isString().isLength({ min: 4, max: 8 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const email = req.body.email.toLowerCase().trim();
    const { code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid code" });
    const v = await verifyOtpCode(email, "login_email_otp_only", code);
    if (!v.ok) return res.status(401).json({ error: v.error || "Invalid code" });
    const denial = getAccountAccessDenial(user);
    if (denial) return res.status(403).json(denial);
    if (needsEmailVerificationGate(user)) {
      return res.status(403).json({
        error: "Verify your email before signing in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }
    const token = signToken(user);
    return res.json({ token, user: user.toSafeJSON() });
  }
);

authRouter.post(
  "/register/verify-email",
  [body("email").isEmail(), body("otpCode").isString().isLength({ min: 4, max: 8 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const email = req.body.email.trim().toLowerCase();
    const { otpCode } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.role !== "end_user") {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    const accessDenial = getAccountAccessDenial(user);
    if (accessDenial) return res.status(403).json(accessDenial);
    if (user.emailVerified !== false) {
      return res.status(400).json({ error: "Email already verified. Sign in with your email and password." });
    }
    const v = await verifyOtpCode(email, "register_email_verify", otpCode);
    if (!v.ok) return res.status(401).json({ error: v.error || "Invalid code" });
    user.emailVerified = true;
    await user.save();
    const token = signToken(user);
    return res.json({ token, user: user.toSafeJSON() });
  }
);

authRouter.post("/register/resend-email-code", [body("email").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email, role: "end_user", emailVerified: false });
  if (!user) {
    return res.json({ ok: true, message: "If this account needs email verification, a code was sent." });
  }
  if (getAccountAccessDenial(user)) {
    return res.json({ ok: true, message: "If this account needs email verification, a code was sent." });
  }
  if (!allowOtpRequest(`register-resend:${email}`)) {
    return res.status(429).json({ error: "Please wait before requesting another code" });
  }
  try {
    const otpSend = await createAndEmailOtp(email, "register_email_verify");
    const out = { ok: true, message: "Verification code sent." };
    if (process.env.NODE_ENV === "test" && otpSend.devCode) {
      out._testOnlyEmailCode = otpSend.devCode;
    }
    return res.json(out);
  } catch (e) {
    return res.status(503).json({ error: e.message || "Could not send email" });
  }
});

authRouter.post("/forgot/request", [body("email").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const email = req.body.email.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ ok: true, message: "If an account exists, a code was sent." });
  }
  if (!allowOtpRequest(`forgot:${email}`)) {
    return res.status(429).json({ error: "Please wait before requesting another code" });
  }
  try {
    await createAndEmailOtp(email, "password_reset");
  } catch (e) {
    return res.status(503).json({ error: e.message || "Could not send email" });
  }
  return res.json({ ok: true, message: "If an account exists, a code was sent." });
});

authRouter.post(
  "/forgot/reset",
  [body("email").isEmail(), body("code").isString().isLength({ min: 4, max: 8 }), body("newPassword").isLength({ min: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const email = req.body.email.toLowerCase().trim();
    const { code, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid or expired code" });
    const v = await verifyOtpCode(email, "password_reset", code);
    if (!v.ok) return res.status(400).json({ error: v.error || "Invalid or expired code" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    /** Inbox proved via reset code — same assurance as `register_email_verify`. */
    if (user.role === "end_user" && user.emailVerified === false) {
      user.emailVerified = true;
    }
    await user.save();
    const denial = getAccountAccessDenial(user);
    if (denial) {
      if (denial.code === "ACCOUNT_PENDING") {
        return res.json({
          user: user.toSafeJSON(),
          pendingApproval: true,
          message: "Password updated. Sign in after your account is approved.",
        });
      }
      return res.json({
        user: user.toSafeJSON(),
        accountRestricted: true,
        code: denial.code,
        message: `${denial.error} Your password was updated; you cannot receive a session until an administrator restores access.`,
      });
    }
    const token = signToken(user);
    return res.json({ token, user: user.toSafeJSON() });
  }
);

authRouter.get("/me", requireAuth(true), async (req, res) => {
  return res.json({ user: req.user.toSafeJSON() });
});

authRouter.get("/profile", requireAuth(true), async (req, res) => {
  return res.json({ user: req.user.toSafeJSON() });
});

/**
 * Self-service profile: email/phone stay read-only.
 * Company accounts (including Super Admin) may also update businessName + address from the app.
 */
authRouter.patch(
  "/profile",
  requireAuth(true),
  [
    body("name").optional().isString().trim().isLength({ min: 0, max: 120 }),
    body("businessName").optional().isString().trim().isLength({ min: 0, max: 200 }),
    body("address").optional().isString().trim().isLength({ min: 0, max: 500 }),
    body("upiVpa").optional().isString().trim().isLength({ max: 80 }),
    body("upiMerchantName").optional().isString().trim().isLength({ max: 80 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if ("email" in req.body || "phone" in req.body) {
      return res.status(400).json({
        error: "Email and phone cannot be changed in the app. Ask your administrator if your sign-in email or number must change.",
        code: "PROFILE_CONTACT_READ_ONLY",
      });
    }

    const companyLike = req.user.role === "company" || req.user.isPlatformOwner;
    if (!companyLike && ("businessName" in req.body || "address" in req.body)) {
      return res.status(400).json({
        error: "Only your name can be updated from the profile screen.",
        code: "PROFILE_NAME_ONLY",
      });
    }

    if (req.body.name !== undefined) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      req.user.name = name || undefined;
    }
    if (companyLike) {
      if (req.body.businessName !== undefined) {
        const b = typeof req.body.businessName === "string" ? req.body.businessName.trim() : "";
        req.user.businessName = b || undefined;
      }
      if (req.body.address !== undefined) {
        const a = typeof req.body.address === "string" ? req.body.address.trim() : "";
        req.user.address = a || undefined;
      }
    }
    if (req.body.upiVpa !== undefined) {
      const v = typeof req.body.upiVpa === "string" ? req.body.upiVpa.trim() : "";
      req.user.upiVpa = v.slice(0, 80);
    }
    if (req.body.upiMerchantName !== undefined) {
      const v = typeof req.body.upiMerchantName === "string" ? req.body.upiMerchantName.trim() : "";
      req.user.upiMerchantName = v.slice(0, 80);
    }
    await req.user.save();
    return res.json({ user: req.user.toSafeJSON() });
  }
);

authRouter.patch("/me/location", requireAuth(true), async (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat and lng numbers required" });
  }
  req.user.location = { type: "Point", coordinates: [lng, lat] };
  await req.user.save();
  return res.json({ user: req.user.toSafeJSON() });
});
