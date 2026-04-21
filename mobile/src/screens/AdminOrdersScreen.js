import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows, orderStatusStyle, orderStatusLabel } from "../theme";

const CHANNELS = [
  { id: "", label: "All" },
  { id: "marketplace", label: "Marketplace" },
  { id: "stock", label: "Stock" },
];

export function AdminOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [channel, setChannel] = useState("");

  const load = useCallback(async () => {
    const params = { limit: 80 };
    if (channel) params.orderChannel = channel;
    const { data } = await adminApi.orders(params);
    setOrders(data.orders || []);
  }, [channel]);

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
    <View style={styles.root}>
      <View style={styles.chipRow}>
        {CHANNELS.map((c) => (
          <Pressable key={c.id || "all"} onPress={() => setChannel(c.id)} style={[styles.chip, channel === c.id && styles.chipOn]}>
            <Text style={[styles.chipTxt, channel === c.id && styles.chipTxtOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listPad}
        data={orders}
        keyExtractor={(o) => String(o._id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item: o }) => {
          const st = orderStatusStyle(o.status);
          return (
            <Pressable
              onPress={() => navigation.navigate("AdminOrderDetail", { orderId: o._id })}
              style={[styles.card, shadows.card, { borderLeftWidth: 4, borderLeftColor: st.border }]}
            >
              <Text style={styles.total}>
                ₹{Number(o.total).toFixed(2)} · {orderStatusLabel(o.status)}
              </Text>
              <Text style={styles.chTag}>{o.orderChannel === "stock" ? "Stock order" : "Marketplace order"}</Text>
              <Text style={styles.line}>
                Buyer: {(o.buyerId && (o.buyerId.name || o.buyerId.businessName)) || "—"} · Seller:{" "}
                {(o.sellerId && (o.sellerId.name || o.sellerId.businessName)) || "—"}
              </Text>
              <Text style={styles.date}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</Text>
              <Text style={styles.tapHint}>Tap for full detail ›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  chipTxt: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  chipTxtOn: { color: colors.header },
  list: { flex: 1 },
  listPad: { padding: 16, paddingBottom: 40 },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  total: { fontSize: 16, fontWeight: "800", color: colors.text },
  chTag: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.secondaryBlue },
  line: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  date: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  tapHint: { marginTop: 8, fontSize: 12, color: colors.secondaryBlue, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 40, color: colors.textSecondary },
});
