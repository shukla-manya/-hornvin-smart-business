import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { PasswordInput } from "../components/PasswordInput";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/resources";
import { colors, radii, shadows } from "../theme";

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { token, refreshMe } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current) return Alert.alert("Password", "Enter your current password.");
    if (next.length < 6) return Alert.alert("Password", "New password must be at least 6 characters.");
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon card header */}
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🔑</Text>
          </View>
          <Text style={styles.cardTitle}>Change password</Text>
          <Text style={styles.cardSub}>Enter your current password, then choose a new one.</Text>

          <Text style={styles.label}>Current password</Text>
          <PasswordInput value={current} onChangeText={setCurrent} placeholder="Current password" />

          <Text style={styles.label}>New password</Text>
          <PasswordInput value={next} onChangeText={setNext} placeholder="At least 6 characters" />

          <Pressable onPress={submit} disabled={busy || !token} style={[styles.cta, busy && { opacity: 0.55 }]}>
            <Text style={styles.ctaText}>Save password</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.selectionBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
  },
  iconText: { fontSize: 28 },

  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.header,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  cardSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },

  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
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
