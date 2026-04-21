import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { rewardsApi } from "../api/resources";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, radii } from "../theme";

export function RewardsScreen() {
  const { refreshMe } = useAuth();
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await rewardsApi.me();
      setPoints(data.rewardPoints ?? 0);
      setHistory(data.history || []);
      await refreshMe().catch(() => {});
    } catch {
      setPoints(0);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const redeem = async () => {
    if (!code.trim()) return Alert.alert("Code", "Enter a coupon code.");
    setBusy(true);
    try {
      const { data } = await rewardsApi.redeem({ code: code.trim() });
      setCode("");
      Alert.alert("Redeemed", `+${data.pointsAwarded} points. Balance: ${data.rewardPoints}.`);
      await load();
    } catch (e) {
      Alert.alert("Coupon", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
    >
      <Text style={styles.h1}>Coupons & rewards</Text>
      <Text style={styles.sub}>Redeem Hornvin promo codes for loyalty points. Discount % on coupons is shown for future checkout use.</Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.pointsLabel}>Your points</Text>
        {loading && !history.length ? (
          <ActivityIndicator color={colors.secondaryBlue} />
        ) : (
          <Text style={styles.points}>{points}</Text>
        )}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Redeem code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="e.g. WELCOME50"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Pressable onPress={redeem} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
          <Text style={styles.btnTxt}>{busy ? "…" : "Apply code"}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Recent redemptions</Text>
      {history.length === 0 ? (
        <Text style={styles.muted}>No history yet.</Text>
      ) : (
        history.map((h) => (
          <View key={h._id} style={[styles.row, shadows.card]}>
            <Text style={styles.code}>{h.couponId?.code || "—"}</Text>
            <Text style={styles.muted}>+{h.pointsAwarded} pts</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  pointsLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  points: { fontSize: 40, fontWeight: "800", color: colors.cta, marginTop: 6 },
  cardTitle: { fontWeight: "800", color: colors.header, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  btn: { marginTop: 12, backgroundColor: colors.cta, paddingVertical: 12, borderRadius: radii.button, alignItems: "center" },
  btnTxt: { color: colors.white, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "800", color: colors.header, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 12, marginBottom: 8, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  code: { fontWeight: "700", color: colors.text },
  muted: { color: colors.textSecondary, fontSize: 14 },
});
