import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminPaymentsScreen() {
  const [payments, setPayments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminApi.payments({ limit: 80 });
    setPayments(data.payments || []);
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
      data={payments}
      keyExtractor={(p) => String(p._id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item: p }) => (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.amt}>
            {p.currency || "INR"} {Number(p.amount).toFixed(2)} · {p.status}
          </Text>
          <Text style={styles.line}>
            Payer: {(p.payerId && p.payerId.name) || "—"} → Payee: {(p.payeeId && p.payeeId.name) || "—"}
          </Text>
          <Text style={styles.date}>{p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No payments recorded</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  amt: { fontSize: 16, fontWeight: "800", color: colors.text },
  line: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  date: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: "center", marginTop: 40, color: colors.textSecondary },
});
