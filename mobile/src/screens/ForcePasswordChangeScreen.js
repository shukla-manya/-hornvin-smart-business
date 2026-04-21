import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/resources";
import { colors } from "../theme";
import { resetAfterAuth } from "../navigation/navigationRoot";

/**
 * Shown after first login when Super Admin / distributor created the account with a temporary password.
 * Other screens stay blocked until this completes (`MUST_CHANGE_PASSWORD` on the API).
 */
export function ForcePasswordChangeScreen() {
  const { token, refreshMe } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 6) return Alert.alert("Password", "Use at least 6 characters for the new password.");
    if (!current) return Alert.alert("Password", "Enter the password you were given.");
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
      <Text style={styles.h1}>Set a new password</Text>
      <Text style={styles.sub}>
        Your Super Admin or distributor created this account and sent you a temporary password (check email if they used
        yours). You cannot use the rest of the app until you set a new password here.
      </Text>
      <Text style={styles.label}>Current password (the one you were given)</Text>
      <TextInput
        style={styles.input}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Temporary password"
        placeholderTextColor={colors.textSecondary}
      />
      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        placeholder="At least 6 characters"
        placeholderTextColor={colors.textSecondary}
      />
      <Pressable onPress={submit} disabled={busy || !token} style={[styles.cta, busy && { opacity: 0.6 }]}>
        <Text style={styles.ctaText}>Save and continue</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 12, color: colors.textSecondary, lineHeight: 21, marginBottom: 24 },
  label: { color: colors.textSecondary, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    color: colors.text,
  },
  cta: { marginTop: 28, backgroundColor: colors.cta, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
