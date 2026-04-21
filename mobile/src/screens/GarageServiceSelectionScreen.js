import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";
import { resetToMain } from "../navigation/navigationRoot";
import { GARAGE_SERVICE_OPTIONS } from "../constants/garageServices";

/**
 * Retail onboarding: after profile, pick what the bay focuses on (stored on user). From Profile, pass `edit: true` to adjust.
 */
export function GarageServiceSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editMode = route.params?.edit === true;
  const { user, updateProfile } = useAuth();
  const initial = useMemo(() => new Set(user?.garageServices || []), [user?.garageServices]);
  const [selected, setSelected] = useState(() => initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(new Set(user?.garageServices || []));
  }, [user?.garageServices]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    const list = GARAGE_SERVICE_OPTIONS.map((o) => o.id).filter((id) => selected.has(id));
    if (!list.length) {
      Alert.alert("Services", "Choose at least one area your garage works on.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ garageServices: list });
      if (editMode && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        resetToMain();
      }
    } catch (e) {
      Alert.alert("Could not save", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (user?.role !== "retail") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Service selection is only for garage (retail) accounts.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>What do you service?</Text>
      <Text style={styles.sub}>
        Pick everything that applies. This unlocks your dashboard and helps you see the right Hornvin flows (stock, jobs,
        marketplace).
      </Text>
      <View style={styles.grid}>
        {GARAGE_SERVICE_OPTIONS.map((o) => {
          const on = selected.has(o.id);
          return (
            <Pressable key={o.id} onPress={() => toggle(o.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.ctaText}>{editMode ? "Save" : "Continue to dashboard"}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 44, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  muted: { color: colors.textSecondary, textAlign: "center" },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 10, color: colors.textSecondary, lineHeight: 21, marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: "100%",
  },
  chipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: colors.secondaryBlue, fontWeight: "800" },
  cta: {
    marginTop: 28,
    backgroundColor: colors.cta,
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
