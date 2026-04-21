import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";
import { resetToMain } from "../navigation/navigationRoot";

/**
 * Mandatory first step after sign-in when the account has no display name yet (`needsProfileSetup` from API).
 */
export function ProfileSetupScreen() {
  const { user, updateProfile, updateProfileName } = useAuth();
  const companyLike = user?.role === "company" || user?.isPlatformOwner;
  const [name, setName] = useState(user?.name || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [address, setAddress] = useState(user?.address || "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("Name", "Enter your name to continue.");
      return;
    }
    setBusy(true);
    try {
      if (companyLike) {
        await updateProfile({
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
        });
      } else {
        await updateProfileName(name.trim());
      }
      resetToMain();
    } catch (e) {
      Alert.alert("Profile", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Complete your profile</Text>
        <Text style={styles.sub}>We need a few details before you can use the app. You can update some of these later in Profile.</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.textSecondary}
        />

        {companyLike ? (
          <>
            <Text style={styles.label}>Business name</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Company or shop name"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>Address (optional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, city"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </>
        ) : null}

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 10, color: colors.textSecondary, lineHeight: 21, marginBottom: 8 },
  label: { color: colors.textSecondary, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.card,
    color: colors.text,
  },
  cta: {
    marginTop: 28,
    backgroundColor: colors.cta,
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
