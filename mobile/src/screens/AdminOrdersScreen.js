import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows, orderStatusStyle, orderStatusLabel } from "../theme";

export function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminApi.orders({ limit: 80 });
    setOrders(data.orders || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
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
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(o) => String(o._id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item: o }) => {
        const st = orderStatusStyle(o.status);
        return (
          <View style={[styles.card, shadows.card, { borderLeftWidth: 4, borderLeftColor: st.border }]}>
            <Text style={styles.total}>₹{Number(o.total).toFixed(2)} · {orderStatusLabel(o.status)}</Text>
            <Text style={styles.line}>
              Buyer: {(o.buyerId && (o.buyerId.name || o.buyerId.businessName)) || "—"} · Seller:{" "}
              {(o.sellerId && (o.sellerId.name || o.sellerId.businessName)) || "—"}
            </Text>
            <Text style={styles.date}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</Text>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  total: { fontSize: 16, fontWeight: "800", color: colors.text },
  line: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  date: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: "center", marginTop: 40, color: colors.textSecondary },
});
