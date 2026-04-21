import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CommonActions, useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { AppLogo } from "../components/AppLogo";
import { FooterCredit } from "../components/FooterCredit";
import { colors, radii } from "../theme";
import { APP_ROLES, roleLabel } from "../constants/roles";
import { resetAfterOnboarding } from "../navigation/navigationRoot";
import { useRegisterableRoles } from "../hooks/useRegisterableRoles";

export function LoginRegisterScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { registerableRoles } = useRegisterableRoles();
  const { login, register, verifyRegisterEmail, resendRegisterEmailCode, forgotPasswordRequest, forgotPasswordReset } =
    useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginEmailOtp, setLoginEmailOtp] = useState("");
  const [loginPhoneOtp, setLoginPhoneOtp] = useState("");
  const [awaitingLoginOtp, setAwaitingLoginOtp] = useState(false);
  const [awaitingRegisterVerify, setAwaitingRegisterVerify] = useState(false);
  const [registerEmailOtp, setRegisterEmailOtp] = useState("");
  const [role, setRole] = useState("end_user");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");

  const roleLocked =
    typeof route.params?.role === "string" && registerableRoles.some((x) => x.id === route.params?.role);

  useFocusEffect(
    useCallback(() => {
      const r = route.params?.role;
      if (typeof r === "string" && APP_ROLES.some((x) => x.id === r)) {
        if (mode === "register" && !registerableRoles.some((x) => x.id === r)) {
          setRole(registerableRoles[0]?.id || "end_user");
        } else {
          setRole(r);
        }
      }
    }, [route.params?.role, mode, registerableRoles])
  );

  const resetForgot = () => {
    setForgotOpen(false);
    setForgotStep(1);
    setForgotEmail("");
    setForgotCode("");
    setForgotNewPw("");
  };

  const onSubmit = async () => {
    if (mode === "register") {
      if (awaitingRegisterVerify) {
        if (!email.trim()) {
          Alert.alert("Email", "Enter the email you registered with.");
          return;
        }
        if (!registerEmailOtp.trim()) {
          Alert.alert("Code", "Enter the 6-digit code from your email.");
          return;
        }
        setBusy(true);
        try {
          const vData = await verifyRegisterEmail(email, registerEmailOtp);
          setAwaitingRegisterVerify(false);
          setRegisterEmailOtp("");
          if (vData?.user) resetAfterOnboarding(vData.user);
        } catch (e) {
          Alert.alert("Auth", e.response?.data?.error || e.message);
        } finally {
          setBusy(false);
        }
        return;
      }
      if (!password || password.length < 6) {
        Alert.alert("Password", "Use at least 6 characters.");
        return;
      }
      if (!email && !phone) {
        Alert.alert("Contact", "Enter email or phone.");
        return;
      }
      if (!businessName.trim()) {
        Alert.alert("Business", "Enter your business or shop name.");
        return;
      }
      setBusy(true);
      try {
        const data = await register({
          email: email || undefined,
          phone: phone || undefined,
          password,
          role,
          name,
          businessName: businessName.trim(),
        });
        if (data?.needsEmailVerification) {
          setAwaitingRegisterVerify(true);
          Alert.alert("Check email", data.message || "We sent a code to verify your address. Enter it below, then tap Continue.");
          return;
        }
        if (data?.pendingApproval) {
          Alert.alert(
            "Pending approval",
            role === "retail"
              ? "Super Admin must approve your retail account before you can sign in. You will not receive a session until then."
              : "An administrator must approve your account before you can sign in. You will not receive a session until then."
          );
          return;
        }
        if (data?.token && data?.user) resetAfterOnboarding(data.user);
      } catch (e) {
        const code = e.response?.data?.code;
        const msg = e.response?.data?.error || e.message;
        Alert.alert(
          code === "ROLE_NOT_SELF_SIGNUP"
            ? "Distributor accounts"
            : code === "REGISTER_ROLE_NOT_ALLOWED"
              ? "Sign-up not available"
              : code === "BUSINESS_NAME_REQUIRED"
                ? "Business name"
                : "Auth",
          code === "BUSINESS_NAME_REQUIRED" ? "Enter your business or shop name." : msg
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert("Password", "Use at least 6 characters.");
      return;
    }
    if (!email && !phone) {
      Alert.alert("Contact", "Enter email or phone.");
      return;
    }
    if (email.trim() && awaitingLoginOtp && (!loginEmailOtp.trim() || !loginPhoneOtp.trim())) {
      Alert.alert("Codes", "Enter both the email code and the phone code (phone code is also printed in the API server terminal).");
      return;
    }
    setBusy(true);
    try {
      const r = await login({
        email: email.trim() || undefined,
        phone: phone || undefined,
        password,
        emailOtp: email.trim() && awaitingLoginOtp ? loginEmailOtp.trim() : undefined,
        phoneOtp: email.trim() && awaitingLoginOtp ? loginPhoneOtp.trim() : undefined,
      });
      if (r?.needsOtp) {
        setAwaitingLoginOtp(true);
        setLoginEmailOtp("");
        setLoginPhoneOtp("");
        Alert.alert(
          "Check email & phone",
          r.message || "Two codes were sent: one to your email and one for your phone (see API terminal for the phone code)."
        );
      } else if (r?.user) {
        resetAfterOnboarding(r.user);
      }
    } catch (e) {
      const code = e.response?.data?.code;
      Alert.alert(
        code === "ACCOUNT_PENDING"
          ? "Pending approval"
          : code === "EMAIL_NOT_VERIFIED"
            ? "Verify email"
            : code === "ACCOUNT_SUSPENDED"
              ? "Account suspended"
              : code === "ACCOUNT_BLOCKED"
                ? "Account blocked"
                : "Auth",
        e.response?.data?.error || e.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Full-screen gradient backdrop */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Brand hero */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <AppLogo size={52} />
        </View>
        <Text style={styles.wordmark}>Hornvin</Text>
        <Text style={styles.tagline}>Your auto business, simplified</Text>
      </View>

      {/* Floating form sheet */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => navigation.navigate("RoleSelection")} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Choose account type</Text>
        </Pressable>

        {/* Mode toggle pill */}
        <View style={styles.togglePill}>
          <Pressable
            onPress={() => {
              setMode("login");
              setAwaitingLoginOtp(false);
              setLoginEmailOtp("");
              setLoginPhoneOtp("");
              setAwaitingRegisterVerify(false);
              setRegisterEmailOtp("");
            }}
            style={[styles.pillBtn, mode === "login" && styles.pillBtnOn]}
          >
            <Text style={[styles.pillText, mode === "login" && styles.pillTextOn]}>Sign in</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("register");
              setRole((r) => (registerableRoles.some((x) => x.id === r) ? r : registerableRoles[0]?.id || "end_user"));
              setAwaitingRegisterVerify(false);
              setRegisterEmailOtp("");
            }}
            style={[styles.pillBtn, mode === "register" && styles.pillBtnOn]}
          >
            <Text style={[styles.pillText, mode === "register" && styles.pillTextOn]}>Register</Text>
          </Pressable>
        </View>

        {/* Register-only fields */}
        {mode === "register" && (
          <>
            <Text style={styles.label}>Account type</Text>
            {roleLocked ? (
              <View style={styles.lockedBox}>
                <Text style={styles.lockedText}>{roleLabel(role)}</Text>
                <Pressable onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "RoleSelection" }] }))}>
                  <Text style={styles.changeRole}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.roleWrap}>
                {registerableRoles.map((r) => (
                  <Pressable key={r.id} onPress={() => setRole(r.id)} style={[styles.roleChip, role === r.id && styles.roleChipOn]}>
                    <Text style={[styles.roleChipText, role === r.id && styles.roleChipTextOn]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {role === "company" ? (
              <Text style={styles.hint}>
                One-time Hornvin root: your email must match BOOTSTRAP_PLATFORM_OWNER_EMAIL on the API exactly. This creates the
                only company / Super Admin account.
              </Text>
            ) : null}
            <Text style={styles.label}>Your name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textSecondary} style={styles.input} />
            <Text style={styles.label}>Business name</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Shop or company name"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@gmail.com"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {mode === "login" ? (
          <>
            <Text style={styles.label}>Phone (only if signing in with phone)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+91…"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </>
        ) : null}

        {mode === "login" && (
          <>
            <Text style={styles.hint}>
              Email + password sign-in sends two verification codes — one to your email, one to your phone.
            </Text>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            {email.trim() && awaitingLoginOtp ? (
              <>
                <Text style={styles.label}>Code from email</Text>
                <TextInput
                  value={loginEmailOtp}
                  onChangeText={setLoginEmailOtp}
                  keyboardType="number-pad"
                  placeholder="6-digit email code"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <Text style={styles.label}>Code for phone (see API server log)</Text>
                <TextInput
                  value={loginPhoneOtp}
                  onChangeText={setLoginPhoneOtp}
                  keyboardType="number-pad"
                  placeholder="6-digit phone code"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </>
            ) : null}
          </>
        )}

        {mode === "register" && (
          <>
            <Text style={styles.label}>{email.trim() ? "Mobile (required with email)" : "Phone (if no email)"}</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91…" placeholderTextColor={colors.textSecondary} style={styles.input} />
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            {awaitingRegisterVerify ? (
              <>
                <Text style={styles.hint}>Enter the verification code we sent to your email.</Text>
                <Text style={styles.label}>Email verification code</Text>
                <TextInput
                  value={registerEmailOtp}
                  onChangeText={setRegisterEmailOtp}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <Pressable
                  onPress={async () => {
                    if (!email.trim()) return Alert.alert("Email", "Enter your email.");
                    setBusy(true);
                    try {
                      await resendRegisterEmailCode(email);
                      Alert.alert("Check email", "If this account still needs verification, we sent a new code.");
                    } catch (e) {
                      Alert.alert("Auth", e.response?.data?.error || e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkTxt}>Resend code</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}

        <Pressable onPress={onSubmit} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
          <Text style={styles.ctaText}>
            {mode === "register"
              ? awaitingRegisterVerify
                ? "Verify & continue"
                : "Create account"
              : awaitingLoginOtp
                ? "Sign in with codes"
                : "Continue"}
          </Text>
        </Pressable>

        {mode === "login" ? (
          <Pressable onPress={() => setForgotOpen(true)} style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Forgot password?</Text>
          </Pressable>
        ) : null}

        <FooterCredit compact />
      </ScrollView>

      {/* Forgot password modal */}
      <Modal visible={forgotOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{forgotStep === 1 ? "Reset password" : "New password"}</Text>
            {forgotStep === 1 ? (
              <>
                <Text style={styles.modalHint}>
                  Enter the email on your account. We'll send a reset code — phone-only accounts need an admin to add email first.
                </Text>
                <TextInput
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={resetForgot} style={styles.modalSecondary}>
                    <Text style={styles.modalSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (!forgotEmail.trim()) return Alert.alert("Email", "Enter your email.");
                      setBusy(true);
                      try {
                        await forgotPasswordRequest(forgotEmail);
                        setForgotStep(2);
                        Alert.alert("Check email", "Enter the code and your new password.");
                      } catch (e) {
                        Alert.alert("Error", e.response?.data?.error || e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    style={styles.cta}
                  >
                    <Text style={styles.ctaText}>Send code</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  value={forgotCode}
                  onChangeText={setForgotCode}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <TextInput
                  value={forgotNewPw}
                  onChangeText={setForgotNewPw}
                  secureTextEntry
                  placeholder="New password (min 6)"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { marginTop: 10 }]}
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setForgotStep(1)} style={styles.modalSecondary}>
                    <Text style={styles.modalSecondaryText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (forgotNewPw.length < 6) return Alert.alert("Password", "Min 6 characters.");
                      setBusy(true);
                      try {
                        const data = await forgotPasswordReset(forgotEmail, forgotCode, forgotNewPw);
                        resetForgot();
                        if (data?.accountRestricted) {
                          const t =
                            data.code === "ACCOUNT_SUSPENDED"
                              ? "Account suspended"
                              : data.code === "ACCOUNT_BLOCKED"
                                ? "Account blocked"
                                : "Account restricted";
                          Alert.alert(t, data.message || "You cannot sign in until an administrator restores access.");
                          return;
                        }
                        if (data?.pendingApproval) {
                          Alert.alert(
                            "Pending approval",
                            data.message || "Your account is not approved yet. Sign in after approval."
                          );
                          return;
                        }
                        if (data?.token && data?.user) resetAfterOnboarding(data.user);
                      } catch (e) {
                        Alert.alert("Error", e.response?.data?.error || e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    style={styles.cta}
                  >
                    <Text style={styles.ctaText}>Save</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ────────────────────────────────────────────────
  hero: {
    alignItems: "center",
    paddingTop: 72,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  wordmark: {
    marginTop: 16,
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.5,
  },

  // ── Form sheet ──────────────────────────────────────────
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetContent: {
    padding: 24,
    paddingBottom: 48,
  },

  // ── Back link ───────────────────────────────────────────
  backLink: { marginBottom: 18, alignSelf: "flex-start" },
  backLinkText: { color: colors.secondaryBlue, fontWeight: "600", fontSize: 13 },

  // ── Toggle pill ─────────────────────────────────────────
  togglePill: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  pillBtnOn: {
    backgroundColor: colors.card,
    shadowColor: "#2F2A26",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pillText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  pillTextOn: { color: colors.header, fontWeight: "700" },

  // ── Form fields ─────────────────────────────────────────
  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 15,
  },

  // ── Role chips ──────────────────────────────────────────
  roleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleChipOn: { borderColor: colors.secondaryBlue, backgroundColor: colors.selectionBg },
  roleChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  roleChipTextOn: { color: colors.secondaryBlue, fontWeight: "700" },
  lockedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: colors.background,
    marginTop: 4,
  },
  lockedText: { fontSize: 15, fontWeight: "600", color: colors.header },
  changeRole: { color: colors.secondaryBlue, fontWeight: "700", fontSize: 13 },

  // ── CTA button ──────────────────────────────────────────
  cta: {
    marginTop: 26,
    backgroundColor: colors.cta,
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: "center",
    shadowColor: colors.cta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },

  // ── Text links ──────────────────────────────────────────
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkTxt: { color: colors.secondaryBlue, fontWeight: "600", fontSize: 14 },

  // ── Forgot password modal ───────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,18,16,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8, letterSpacing: 0.2 },
  modalHint: { color: colors.textSecondary, marginBottom: 16, fontSize: 13, lineHeight: 19 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  modalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSecondaryText: { color: colors.text, fontWeight: "600" },
});
