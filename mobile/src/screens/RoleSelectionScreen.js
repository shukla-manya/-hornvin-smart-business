import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { AppLogo } from "../components/AppLogo";
import { FooterCredit } from "../components/FooterCredit";
import { colors } from "../theme";
import { useRegisterableRoles } from "../hooks/useRegisterableRoles";

export function RoleSelectionScreen() {
  const navigation = useNavigation();
  const { registerableRoles, loading } = useRegisterableRoles();
  const defaultRole = useMemo(() => registerableRoles[0]?.id || "end_user", [registerableRoles]);
  const [selected, setSelected] = useState("end_user");

  useEffect(() => {
    setSelected((prev) => (registerableRoles.some((r) => r.id === prev) ? prev : defaultRole));
  }, [defaultRole, registerableRoles]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <AppLogo size={52} />
        <Text style={styles.h1}>How will you use Hornvin?</Text>
        <Text style={styles.sub}>Pick a role for a new account. You can still sign in if you already have one.</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Distributor</Text>
          <Text style={styles.noticeBody}>
            Distributor accounts are created only by the Super Admin. If you are a distributor, use Sign in with the
            credentials you were given.
          </Text>
        </View>
        <View style={[styles.notice, { marginTop: 0, marginBottom: 14 }]}>
          <Text style={styles.noticeTitle}>Retail / garage</Text>
          <Text style={styles.noticeBody}>
            You can sign up here as retail — your account stays pending until a Super Admin approves it. If your distributor
            created your shop for you, use Sign in and change your password when prompted.
          </Text>
        </View>
        <View style={[styles.notice, { marginTop: 0, marginBottom: 14 }]}>
          <Text style={styles.noticeTitle}>End user (buyer)</Text>
          <Text style={styles.noticeBody}>
            Register → verify email with a one-time code → you are active. Then browse, chat with sellers, and send inquiries.
            Each email sign-in also uses a second code we send to your inbox.
          </Text>
        </View>
        <View style={[styles.notice, { marginTop: 0, marginBottom: 14 }]}>
          <Text style={styles.noticeTitle}>Super Admin (first-time setup)</Text>
          <Text style={styles.noticeBody}>
            Choose Company, then register with the email your server sets as BOOTSTRAP_PLATFORM_OWNER_EMAIL (documented in
            server .env.example). That first company account becomes the platform owner. After sign-in, open Profile → Super
            Admin panel to approve users and create distributors.
          </Text>
        </View>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.secondaryBlue} />
            <Text style={styles.loadingText}>Loading sign-up options…</Text>
          </View>
        ) : null}
        {registerableRoles.map((r) => (
          <Pressable key={r.id} onPress={() => setSelected(r.id)} style={[styles.card, selected === r.id && styles.cardOn]}>
            <Text style={[styles.cardTitle, selected === r.id && styles.cardTitleOn]}>{r.label}</Text>
            <Text style={styles.cardBlurb}>{r.blurb}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => navigation.navigate("LoginRegister", { role: selected })} style={styles.primary}>
          <Text style={styles.primaryText}>Continue to sign up</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("LoginRegister", {})} style={styles.secondary}>
          <Text style={styles.secondaryText}>I already have an account — Sign in</Text>
        </Pressable>
        <FooterCredit />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { paddingTop: 48, paddingBottom: 24, paddingHorizontal: 20 },
  h1: { marginTop: 16, fontSize: 22, fontWeight: "600", color: colors.white, letterSpacing: 0.2 },
  sub: { marginTop: 10, color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 21, fontWeight: "500" },
  scroll: { padding: 16, paddingBottom: 32 },
  notice: {
    backgroundColor: colors.selectionBg,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  noticeTitle: { fontWeight: "600", color: colors.header, marginBottom: 6, fontSize: 14, letterSpacing: 0.15 },
  noticeBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  cardOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  cardTitleOn: { color: colors.header },
  cardBlurb: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  primary: {
    marginTop: 8,
    backgroundColor: colors.cta,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#2F2A26",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryText: { color: colors.white, fontWeight: "600", fontSize: 16, letterSpacing: 0.3 },
  secondary: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: colors.secondaryBlue, fontWeight: "600", fontSize: 15 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
});
