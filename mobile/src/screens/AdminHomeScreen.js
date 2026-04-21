import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminHomeScreen({ navigation }) {
  const [summary, setSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
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
    try {
      const { data } = await adminApi.dashboard();
      setDashboard(data);
    } catch {
      setDashboard(null);
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
      <Text style={styles.sub}>
        Single platform owner (company role). No public self-registration for this account — use the credentials provisioned for
        Hornvin. You control distributors, garage approvals, global catalog, all orders, analytics, coupons, and push broadcasts.
      </Text>
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

      {loading && !summary && !dashboard ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.secondaryBlue} />
      ) : (
        <>
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.cardTitle}>Dashboard</Text>
            <Row label="Garages (under Hornvin)" value={String(dashboard?.totalGarages ?? "—")} />
            <Row label="Distributors" value={String(dashboard?.totalDistributors ?? "—")} />
            <Row label="Garages pending approval" value={String(dashboard?.retailPendingApproval ?? 0)} />
            <Row label="Total orders (all channels)" value={String(dashboard?.totalOrders ?? "—")} />
            <Row label="Marketplace orders" value={String(dashboard?.ordersMarketplace ?? "—")} />
            <Row label="Stock orders" value={String(dashboard?.ordersStock ?? "—")} />
            <Row label="Revenue (excl. cancelled)" value={`₹${Number(dashboard?.totalRevenue ?? summary?.totalRevenue ?? 0).toFixed(2)}`} />
            <Row label="Active users" value={String(dashboard?.activeUsers ?? summary?.activeUsers ?? "—")} />
          </View>
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.cardTitle}>Catalog & activity</Text>
            <Row label="Product rows" value={String(summary?.productCount ?? "—")} />
            {summary?.orderCountByStatus ? (
              <Text style={styles.small}>
                Order statuses: {Object.entries(summary.orderCountByStatus)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        </>
      )}

      {dashboard?.recentOrders?.length ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Recent platform orders</Text>
          {dashboard.recentOrders.slice(0, 8).map((o) => (
            <Pressable
              key={String(o._id)}
              onPress={() => navigation.navigate("AdminOrderDetail", { orderId: o._id })}
              style={styles.recentRow}
            >
              <Text style={styles.recentAmt}>₹{Number(o.total).toFixed(0)} · {o.status}</Text>
              <Text style={styles.recentSub}>
                {o.orderChannel === "stock" ? "Stock" : "Marketplace"} ·{" "}
                {(o.buyerId && (o.buyerId.businessName || o.buyerId.name)) || "?"} →{" "}
                {(o.sellerId && (o.sellerId.businessName || o.sellerId.name)) || "?"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <NavCard title="Users" desc="All accounts, filters, open user details" onPress={() => navigation.navigate("AdminUsers")} />
      <NavCard title="Distributors & chat" desc="List distributors, open DM to resolve issues" onPress={() => navigation.navigate("AdminChatHub")} />
      <NavCard title="Analytics & reports" desc="Trends, top products, users by role" onPress={() => navigation.navigate("AdminAnalytics")} />
      <NavCard title="All orders" desc="Marketplace + stock, filters, order details" onPress={() => navigation.navigate("AdminOrders")} />
      <NavCard title="Transactions" desc="Payments across the platform" onPress={() => navigation.navigate("AdminPayments")} />
      <NavCard title="Global products" desc="Catalog, pricing, hide from marketplace" onPress={() => navigation.navigate("AdminCatalog")} />
      <NavCard title="Categories" desc="Manage category list" onPress={() => navigation.navigate("AdminCategories")} />
      <NavCard title="Coupons" desc="Points, discount codes, campaign caps" onPress={() => navigation.navigate("AdminCoupons")} />
      <NavCard title="Push broadcast" desc="Notify selected roles or everyone" onPress={() => navigation.navigate("AdminPush")} />
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
  recentRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  recentAmt: { fontWeight: "800", color: colors.text, fontSize: 14 },
  recentSub: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
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
