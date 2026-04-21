import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { PasswordInput } from "../components/PasswordInput";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/resources";
import { colors, radii, shadows } from "../theme";
import { resetAfterAuth } from "../navigation/navigationRoot";

export function ForcePasswordChangeScreen() {
  const { token, refreshMe } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current) return Alert.alert("Password", "Enter the temporary password you were given.");
    if (next.length < 6) return Alert.alert("Password", "New password must be at least 6 characters.");
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      const u = await refreshMe();
      resetAfterAuth(u);
    } catch (e) {
      Alert.alert("Could not update", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.iconRing}>
          <Text style={styles.iconText}>🔒</Text>
        </View>
        <Text style={styles.wordmark}>Set your password</Text>
        <Text style={styles.tagline}>You need to set a new password before continuing</Text>
      </View>

      {/* Form sheet */}
      <View style={styles.sheetWrapper}>
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Temporary password</Text>
          <PasswordInput value={current} onChangeText={setCurrent} placeholder="Password you were given" />

          <Text style={styles.label}>New password</Text>
          <PasswordInput value={next} onChangeText={setNext} placeholder="At least 6 characters" />

          <Pressable onPress={submit} disabled={busy || !token} style={[styles.cta, busy && { opacity: 0.55 }]}>
            <Text style={styles.ctaText}>Save & continue</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 34 },
  wordmark: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
    textAlign: "center",
    paddingHorizontal: 16,
  },

  sheetWrapper: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheet: { flex: 1 },
  sheetContent: { padding: 24, paddingBottom: 8 },

  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
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
});
