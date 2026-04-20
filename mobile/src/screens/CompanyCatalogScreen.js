import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { productsApi } from "../api/resources";
import { colors, shadows } from "../theme";

/** Products from your linked company — buy stock via product detail → place order. */
export function CompanyCatalogScreen({ navigation }) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await productsApi.list({ companyId: String(companyId) });
      setItems(data.products || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!companyId) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>Link your distributor account to a company first (use link flow or ask your admin).</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.banner}>Company catalog · tap item to order stock</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item._id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : "No products from this company yet."}</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("ProductDetail", { productId: item._id, orderChannel: "stock" })}
            style={[styles.card, shadows.card]}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.category} · ₹{item.price} · Qty {item.quantity}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: 20, justifyContent: "center" },
  warn: { color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  banner: { padding: 12, backgroundColor: colors.selectionBg, color: colors.header, fontWeight: "600", fontSize: 13 },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { marginTop: 4, color: colors.textSecondary },
  empty: { textAlign: "center", marginTop: 32, color: colors.textSecondary },
});
