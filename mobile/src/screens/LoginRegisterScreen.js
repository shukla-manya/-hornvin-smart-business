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
          resetAfterOnboarding(vData.user);
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
      setBusy(true);
      try {
        const data = await register({
          email: email || undefined,
          phone: phone || undefined,
          password,
          role,
          name,
          businessName,
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
              : "Auth",
          msg
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
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.brandRow}>
          <AppLogo size={58} />
          <Text style={styles.wordmark}>Hornvin</Text>
        </View>
        <Text style={styles.tag}>Home · Explore · Chat · Orders · Dealers</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" style={styles.scrollView}>
        <Pressable onPress={() => navigation.navigate("RoleSelection")} style={styles.backLink}>
          <Text style={styles.backLinkText}>Choosing an account type? See role options</Text>
        </Pressable>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => {
              setMode("login");
              setAwaitingLoginOtp(false);
              setLoginEmailOtp("");
              setLoginPhoneOtp("");
              setAwaitingRegisterVerify(false);
              setRegisterEmailOtp("");
            }}
            style={[styles.toggle, mode === "login" && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, mode === "login" && styles.toggleTextOn]}>Login</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("register");
              setRole((r) => (registerableRoles.some((x) => x.id === r) ? r : registerableRoles[0]?.id || "end_user"));
              setAwaitingRegisterVerify(false);
              setRegisterEmailOtp("");
            }}
            style={[styles.toggle, mode === "register" && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, mode === "register" && styles.toggleTextOn]}>Register</Text>
          </Pressable>
        </View>

        {mode === "register" && (
          <>
            <Text style={styles.label}>Role</Text>
            {roleLocked ? (
              <View style={styles.lockedBox}>
                <Text style={styles.lockedText}>{roleLabel(role)}</Text>
                <Pressable onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "RoleSelection" }] }))}>
                  <Text style={styles.changeRole}>Change account type</Text>
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
                only company / Super Admin account (distributors and garages sit under it).
              </Text>
            ) : null}
            <Text style={styles.label}>Your name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textSecondary} style={styles.input} />
            <Text style={styles.label}>Business (optional)</Text>
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
            <Text style={styles.label}>Phone (only if you sign in with phone, not email)</Text>
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
              Sign in with email + password: you will get two codes — one by email and one for the phone on your account (for
              now the phone code is printed in the Hornvin API terminal). Phone-only accounts use password only.
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
                <Text style={styles.hint}>End-user accounts with email must enter the verification code we sent (then you sign in with password + email OTP as usual).</Text>
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
                  <Text style={styles.linkTxt}>Resend verification code</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}

        <Pressable onPress={onSubmit} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
          <Text style={styles.ctaText}>
            {mode === "register"
              ? awaitingRegisterVerify
                ? "Verify email & continue"
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

        <FooterCredit />
      </ScrollView>

      <Modal visible={forgotOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{forgotStep === 1 ? "Reset password" : "New password"}</Text>
            {forgotStep === 1 ? (
              <>
                <Text style={styles.modalHint}>
                  Enter the email on your account (all roles: company, distributor, retail, end user). We email a reset code
                  — phone-only accounts need an admin to add or change email first.
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
                  style={styles.input}
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
  root: { flex: 1, backgroundColor: colors.background },
  hero: { paddingTop: 48, paddingBottom: 24, paddingHorizontal: 24 },
  scrollView: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  wordmark: { fontSize: 32, fontWeight: "600", color: colors.white, letterSpacing: 1 },
  tag: { marginTop: 12, color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: "500", letterSpacing: 0.8 },
  backLink: { marginBottom: 8, alignSelf: "flex-start" },
  backLinkText: { color: colors.secondaryBlue, fontWeight: "700", fontSize: 14 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  channelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  chipTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  chipTxtOn: { color: colors.secondaryBlue },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  toggleOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  toggleText: { color: colors.textSecondary, fontWeight: "600" },
  toggleTextOn: { color: colors.secondaryBlue },
  label: { color: colors.textSecondary, marginBottom: 6, marginTop: 10, fontSize: 13, fontWeight: "600" },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: colors.card,
  },
  roleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleChipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  roleChipText: { color: colors.textSecondary, fontSize: 13 },
  roleChipTextOn: { color: colors.header, fontWeight: "700" },
  lockedBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    padding: 12,
    backgroundColor: colors.card,
  },
  lockedText: { fontSize: 16, fontWeight: "600", color: colors.header },
  changeRole: { marginTop: 8, color: colors.secondaryBlue, fontWeight: "700", fontSize: 14 },
  cta: {
    marginTop: 20,
    backgroundColor: colors.cta,
    paddingVertical: 15,
    borderRadius: radii.button,
    alignItems: "center",
    shadowColor: "#2F2A26",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  ctaText: { color: colors.white, fontWeight: "600", fontSize: 16, letterSpacing: 0.35 },
  linkBtn: { marginTop: 14, alignItems: "center" },
  linkTxt: { color: colors.secondaryBlue, fontWeight: "600", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(26,23,21,0.45)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.card, borderRadius: radii.card, padding: 18, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8, letterSpacing: 0.2 },
  modalHint: { color: colors.textSecondary, marginBottom: 12, fontSize: 13 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  modalSecondary: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  modalSecondaryText: { color: colors.text, fontWeight: "700" },
});
