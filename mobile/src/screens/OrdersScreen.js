import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ordersApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, orderStatusStyle, orderStatusLabel, orderNextActionLabel } from "../theme";

const NEXT_STATUS = {
  pending: "confirmed",
  confirmed: "shipped",
  shipped: "completed",
};

function StatusTag({ status }) {
  const s = orderStatusStyle(status);
  return (
    <View style={[styles.tag, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.tagText, { color: s.text }]}>{orderStatusLabel(status)}</Text>
    </View>
  );
}

export function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await ordersApi.list();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const advance = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) {
      Alert.alert("Order", "No further transitions from this state.");
      return;
    }
    try {
      await ordersApi.updateStatus(order._id, next);
      await load();
    } catch (e) {
      Alert.alert("Update failed", e.response?.data?.error || e.message);
    }
  };

  const cancel = async (order) => {
    try {
      await ordersApi.updateStatus(order._id, "cancelled");
      await load();
    } catch (e) {
      Alert.alert("Cancel failed", e.response?.data?.error || e.message);
    }
  };

  const supplyHeader =
    user?.role === "company" || user?.role === "distributor" || user?.role === "retail" ? (
      <View style={styles.chainBanner}>
        <Text style={styles.chainBannerTitle}>Supply chain orders</Text>
        <Text style={styles.chainBannerText}>
          Marketplace purchases and stock-channel replenishment (garage ↔ distributor ↔ company) show here. Use Chat from a
          product for pre-sales threads.
        </Text>
      </View>
    ) : user?.role === "end_user" ? (
      <View style={styles.chainBanner}>
        <Text style={styles.chainBannerTitle}>Your orders</Text>
        <Text style={styles.chainBannerText}>Track marketplace purchases; message sellers from Chat or the product page.</Text>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListHeaderComponent={supplyHeader}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : "No orders yet."}</Text>}
        renderItem={({ item }) => {
          const buyer = item.buyerId;
          const seller = item.sellerId;
          const isSeller = seller?._id === user?.id || seller === user?.id;
          const isBuyer = buyer?._id === user?.id || buyer === user?.id;
          return (
            <View style={[styles.card, shadows.card]}>
              <View style={styles.cardTop}>
                <Text style={styles.title}>₹{item.total}</Text>
                <StatusTag status={item.status} />
              </View>
              <Text style={styles.meta}>
                {isBuyer ? "Buying from" : "Selling to"} {isBuyer ? seller?.businessName || seller?.name : buyer?.businessName || buyer?.name}
              </Text>
              <Text style={styles.items}>
                {(item.items || [])
                  .map((it) => `${it.title || "Item"} × ${it.quantity}`)
                  .join(" · ")}
              </Text>
              <View style={styles.row}>
                {isSeller && NEXT_STATUS[item.status] ? (
                  <Pressable onPress={() => advance(item)} style={styles.btnSecondary}>
                    <Text style={styles.btnSecondaryText}>{orderNextActionLabel(item.status)}</Text>
                  </Pressable>
                ) : null}
                {isBuyer && item.status === "pending" ? (
                  <Pressable onPress={() => cancel(item)} style={styles.danger}>
                    <Text style={styles.dangerText}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<FooterCredit />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  meta: { color: colors.textSecondary, marginTop: 8, fontSize: 13 },
  items: { color: colors.text, marginTop: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btnSecondary: { backgroundColor: colors.secondaryBlue, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  btnSecondaryText: { color: colors.white, fontWeight: "800" },
  danger: { borderWidth: 1, borderColor: colors.error, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FEF2F2" },
  dangerText: { color: colors.error, fontWeight: "800" },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
  chainBanner: {
    backgroundColor: "#E9EEF4",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#B9C5D4",
  },
  chainBannerTitle: { fontWeight: "800", color: colors.header, fontSize: 14, marginBottom: 6 },
  chainBannerText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
