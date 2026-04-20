import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/resources";
import { colors } from "../theme";

/**
 * Voluntary password change while signed in (Profile). Same API as first-login forced change.
 */
export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { token, refreshMe } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 6) return Alert.alert("Password", "Use at least 6 characters for the new password.");
    if (!current) return Alert.alert("Password", "Enter your current password.");
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      await refreshMe();
      Alert.alert("Updated", "Your password was changed.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Could not update", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Change password</Text>
        <Text style={styles.sub}>Enter your current password, then choose a new one (at least 6 characters).</Text>
        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Current password"
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
          <Text style={styles.ctaText}>Save password</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  root: { padding: 24, paddingTop: 16 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.header },
  sub: { marginTop: 10, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
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
