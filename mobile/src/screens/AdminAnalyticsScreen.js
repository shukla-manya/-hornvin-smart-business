import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminAnalyticsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await adminApi.analyticsSummary();
    setData(d);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setData(null));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.secondaryBlue} />
      </View>
    );
  }

  const roles = data.usersByRole || {};

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.intro}>Revenue excludes cancelled orders. Trends use the last 7 days.</Text>
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Revenue & users</Text>
        <Row label="Total revenue" value={`₹${Number(data.totalRevenue ?? 0).toFixed(2)}`} />
        <Row label="Active users (approved)" value={String(data.activeUsers ?? "—")} />
        <Row label="Product rows (all)" value={String(data.productCount ?? "—")} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Users by role</Text>
        {Object.entries(roles).map(([k, v]) => (
          <Row key={k} label={k.replace("_", " ")} value={String(v)} />
        ))}
        {!Object.keys(roles).length ? <Text style={styles.muted}>No breakdown</Text> : null}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Orders by channel</Text>
        <Row label="Marketplace" value={String(data.ordersByChannel?.marketplace ?? 0)} />
        <Row label="Stock" value={String(data.ordersByChannel?.stock ?? 0)} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Sales trend (7 days)</Text>
        {(data.salesTrend7d || []).map((d) => (
          <Text key={d._id} style={styles.trendLine}>
            {d._id}: ₹{Number(d.revenue).toFixed(0)} · {d.orders} orders
          </Text>
        ))}
        {!(data.salesTrend7d || []).length ? <Text style={styles.muted}>No orders in this window</Text> : null}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Top products (by revenue)</Text>
        {(data.topProducts || []).map((p, i) => (
          <Text key={String(p.productId) + i} style={styles.trendLine}>
            {p.name} — ₹{Number(p.revenue).toFixed(0)} ({p.units} units)
          </Text>
        ))}
        {!(data.topProducts || []).length ? <Text style={styles.muted}>No completed-line revenue yet</Text> : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{label}</Text>
      <Text style={styles.rowV}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  intro: { color: colors.textSecondary, marginBottom: 12, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: "800", color: colors.header, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowL: { color: colors.textSecondary, flex: 1, paddingRight: 8 },
  rowV: { fontWeight: "700", color: colors.text },
  trendLine: { fontSize: 13, color: colors.text, marginBottom: 6 },
  muted: { color: colors.textSecondary, fontSize: 13 },
});
