import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminHomeScreen({ navigation }) {
  const [summary, setSummary] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.platform();
      setPlatform(data);
    } catch {
      setPlatform(null);
    }
    try {
      const { data } = await adminApi.analyticsSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await load();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>Hornvin Super Admin</Text>
      <Text style={styles.sub}>You are the only company root — global catalog, distributors, all garages, orders & analytics</Text>
      {platform?.controls?.length ? (
        <View style={[styles.banner, shadows.card]}>
          <Text style={styles.bannerTitle}>Your /api/admin controls</Text>
          {platform.controls.map((c) => (
            <Text key={c.id} style={styles.bannerLine}>
              • {c.label}
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.banner, shadows.card]}>
          <Text style={styles.bannerTitle}>System control checklist</Text>
          <Text style={styles.bannerLine}>1. Users → Pending → approve garages and downstream accounts.</Text>
          <Text style={styles.bannerLine}>2. Create distributors (always under Hornvin company).</Text>
          <Text style={styles.bannerLine}>3. Global catalog, categories, all orders, payments, analytics.</Text>
        </View>
      )}

      {loading && !summary ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.secondaryBlue} />
      ) : (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Overview</Text>
          <Row label="Total sales (excl. cancelled)" value={`₹${Number(summary?.totalRevenue ?? 0).toFixed(2)}`} />
          <Row label="Active users (approved)" value={String(summary?.activeUsers ?? "—")} />
          <Row label="Product rows" value={String(summary?.productCount ?? "—")} />
          {summary?.orderCountByStatus ? (
            <Text style={styles.small}>
              Orders: {Object.entries(summary.orderCountByStatus)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </Text>
          ) : null}
        </View>
      )}

      <NavCard title="Users" desc="Approve, reject, block, permissions, create distributors" onPress={() => navigation.navigate("AdminUsers")} />
      <NavCard title="All orders" desc="Monitor every order" onPress={() => navigation.navigate("AdminOrders")} />
      <NavCard title="Transactions" desc="Payments across the platform" onPress={() => navigation.navigate("AdminPayments")} />
      <NavCard title="Global products" desc="Platform catalog" onPress={() => navigation.navigate("AdminCatalog")} />
      <NavCard title="Categories" desc="Manage category list" onPress={() => navigation.navigate("AdminCategories")} />
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function NavCard({ title, desc, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.navCard, shadows.card]}>
      <Text style={styles.navTitle}>{title}</Text>
      <Text style={styles.navDesc}>{desc}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.header },
  sub: { marginTop: 6, color: colors.textSecondary, marginBottom: 12 },
  banner: {
    backgroundColor: colors.selectionBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
  },
  bannerTitle: { fontWeight: "800", color: colors.header, marginBottom: 8 },
  bannerLine: { color: colors.text, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowLabel: { color: colors.textSecondary, flex: 1, paddingRight: 8 },
  rowValue: { fontWeight: "700", color: colors.text },
  small: { marginTop: 8, color: colors.textSecondary, fontSize: 12 },
  navCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  navTitle: { fontSize: 17, fontWeight: "800", color: colors.header },
  navDesc: { marginTop: 4, color: colors.textSecondary, fontSize: 13, paddingRight: 24 },
  chev: { position: "absolute", right: 14, top: 22, fontSize: 22, color: colors.secondaryBlue, fontWeight: "700" },
});
