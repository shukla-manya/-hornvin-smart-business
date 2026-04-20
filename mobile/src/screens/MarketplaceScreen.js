import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { productsApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors, shadows } from "../theme";

export function MarketplaceScreen({ navigation }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (category.trim()) params.category = category.trim();
      const { data } = await productsApi.list(params);
      setItems(data.products || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search products"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          onSubmitEditing={load}
        />
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Category e.g. Engine Oil"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          onSubmitEditing={load}
        />
        <Pressable onPress={load} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>Apply</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          user?.role === "end_user" ? (
            <View style={[styles.endUserCard, shadows.card]}>
              <Text style={styles.endUserTitle}>Welcome{user?.name ? `, ${user.name}` : ""}</Text>
              <Text style={styles.endUserLine}>Browse the marketplace here; use Orders for purchases and Chat for seller threads.</Text>
              <Text style={styles.endUserLine}>Open Profile → Dealer locator for the map view.</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? "Loading…" : "No products yet. Register a company and post catalog items."}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.getParent()?.getParent()?.navigate("ProductDetail", { productId: item._id })}
            style={[styles.card, shadows.card]}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.category} · ₹{item.price} · Qty {item.quantity}
            </Text>
            {(item.sellerId || item.companyId)?.businessName || (item.sellerId || item.companyId)?.name ? (
              <Text style={styles.seller}>
                Seller: {(item.sellerId || item.companyId).businessName || (item.sellerId || item.companyId).name}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListFooterComponent={<FooterCredit />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  endUserCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  endUserTitle: { fontSize: 18, fontWeight: "800", color: colors.header, marginBottom: 8 },
  endUserLine: { color: colors.textSecondary, lineHeight: 20, marginBottom: 6, fontSize: 14 },
  filters: { padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.card,
  },
  btnSecondary: { alignSelf: "flex-start", backgroundColor: colors.secondaryBlue, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  btnSecondaryText: { fontWeight: "800", color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textSecondary, marginTop: 4 },
  seller: { color: colors.secondaryBlue, marginTop: 6, fontSize: 13, fontWeight: "600" },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
});
