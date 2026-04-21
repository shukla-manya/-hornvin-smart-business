import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";
import { resetAfterAuth } from "../navigation/navigationRoot";

/**
 * After OTP login: profile details, then (for retail) service selection, then dashboard (`resetAfterAuth`).
 */
export function ProfileSetupScreen() {
  const { user, updateProfile } = useAuth();
  const companyLike = user?.role === "company" || user?.isPlatformOwner;
  const retailLike = user?.role === "retail";
  const [name, setName] = useState(user?.name || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [address, setAddress] = useState(user?.address || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setBusinessName(user?.businessName || "");
    setAddress(user?.address || "");
  }, [user?.name, user?.businessName, user?.address]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("Name", "Enter your name to continue.");
      return;
    }
    if (retailLike && !businessName.trim()) {
      Alert.alert("Shop name", "Enter your garage or shop name as it appears to customers.");
      return;
    }
    setBusy(true);
    try {
      let nextUser;
      if (companyLike) {
        nextUser = await updateProfile({
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
        });
      } else if (retailLike) {
        nextUser = await updateProfile({
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
        });
      } else {
        nextUser = await updateProfile({ name: name.trim() });
      }
      resetAfterAuth(nextUser);
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
        <Text style={styles.sub}>
          {retailLike
            ? "Garage onboarding: your name and shop, then you will pick services you offer before the dashboard."
            : "We need a few details before you can use the app. You can update some of these later in Profile."}
        </Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.textSecondary}
        />

        {companyLike || retailLike ? (
          <>
            <Text style={styles.label}>{retailLike ? "Garage / shop name" : "Business name"}</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder={retailLike ? "e.g. City Motors Garage" : "Company or shop name"}
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
