import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows, orderStatusLabel } from "../theme";

export function AdminOrderDetailScreen({ route }) {
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    const { data } = await adminApi.orderDetail(orderId);
    setOrder(data.order);
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert("Error", e.response?.data?.error || e.message));
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

  if (!orderId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No order id.</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.secondaryBlue} />
      </View>
    );
  }

  const buyer = order.buyerId;
  const seller = order.sellerId;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.amt}>₹{Number(order.total).toFixed(2)}</Text>
        <Text style={styles.line}>Status: {orderStatusLabel(order.status)}</Text>
        <Text style={styles.line}>Channel: {order.orderChannel === "stock" ? "Stock (company catalog)" : "Marketplace"}</Text>
        <Text style={styles.line}>Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}</Text>
      </View>
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.h2}>Parties</Text>
        <Text style={styles.line}>
          Buyer: {(buyer && (buyer.businessName || buyer.name)) || "—"} ({buyer?.role})
        </Text>
        <Text style={styles.line}>
          Seller: {(seller && (seller.businessName || seller.name)) || "—"} ({seller?.role})
        </Text>
      </View>
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.h2}>Line items</Text>
        {(order.items || []).map((line, i) => (
          <Text key={i} style={styles.line}>
            {line.title || line.productId?.name || "Item"} × {line.quantity} @ ₹{Number(line.unitPrice).toFixed(2)}
          </Text>
        ))}
      </View>
      {order.notes ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.h2}>Notes</Text>
          <Text style={styles.line}>{order.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  amt: { fontSize: 24, fontWeight: "800", color: colors.header },
  h2: { fontWeight: "800", color: colors.header, marginBottom: 8 },
  line: { color: colors.text, marginBottom: 6, fontSize: 14 },
});
