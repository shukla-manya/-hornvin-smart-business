import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { productsApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, radii } from "../theme";

const SUPPLY_ROLES = new Set(["company", "distributor", "retail"]);

export function MarketplaceScreen({ navigation }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  /** Retail: narrow listings to products tied to your linked Hornvin company (upstream chain). */
  const [companyChainOnly, setCompanyChainOnly] = useState(false);

  const load = useCallback(
    async (chainFilter) => {
      const useChain = typeof chainFilter === "boolean" ? chainFilter : companyChainOnly;
      setLoading(true);
      try {
        const params = {};
        if (q.trim()) params.q = q.trim();
        if (category.trim()) params.category = category.trim();
        if (useChain && user?.role === "retail" && user?.companyId) {
          params.companyId = String(user.companyId);
        }
        const { data } = await productsApi.list(params);
        setItems(data.products || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [q, category, companyChainOnly, user?.role, user?.companyId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openDealerMap = () => navigation.getParent()?.getParent()?.navigate("DealerMap");
  const goOrders = () => navigation.navigate("OrdersTab");
  const goChat = () => navigation.navigate("ChatTab");

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
        <Pressable onPress={() => load()} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>Apply</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {user?.role === "end_user" ? (
              <View style={[styles.endUserCard, shadows.card]}>
                <Text style={styles.endUserTitle}>Welcome{user?.name ? `, ${user.name}` : ""}</Text>
                <Text style={styles.endUserLine}>Browse the marketplace here; use Orders for purchases and Chat for seller threads.</Text>
                <Text style={styles.endUserLine}>Open Profile → Dealer locator for the map view.</Text>
              </View>
            ) : null}
            {user?.role && SUPPLY_ROLES.has(user.role) ? (
              <View style={[styles.supplyCard, shadows.card]}>
                <Text style={styles.supplyTitle}>Marketplace — supply chain (Side 2)</Text>
                <Text style={styles.supplyFlow}>Hornvin company → distributor → garage → orders & chat</Text>
                <Text style={styles.supplyBody}>
                  Listings combine the global catalog with distributor and garage SKUs. Place orders from a product page; use
                  Chat for quotes and delivery; Dealer map finds nearby partners.
                </Text>
                <View style={styles.shortcutRow}>
                  <Pressable style={styles.shortcut} onPress={goOrders}>
                    <Text style={styles.shortcutTxt}>Orders</Text>
                  </Pressable>
                  <Pressable style={styles.shortcut} onPress={goChat}>
                    <Text style={styles.shortcutTxt}>Chat</Text>
                  </Pressable>
                  <Pressable style={styles.shortcut} onPress={openDealerMap}>
                    <Text style={styles.shortcutTxt}>Dealer map</Text>
                  </Pressable>
                </View>
                {user?.role === "retail" && user?.companyId ? (
                  <View style={styles.chainRow}>
                    <Pressable
                      onPress={() => {
                        setCompanyChainOnly(false);
                        load(false);
                      }}
                      style={[styles.chainChip, !companyChainOnly && styles.chainChipOn]}
                    >
                      <Text style={[styles.chainChipTxt, !companyChainOnly && styles.chainChipTxtOn]}>All marketplace</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setCompanyChainOnly(true);
                        load(true);
                      }}
                      style={[styles.chainChip, companyChainOnly && styles.chainChipOn]}
                    >
                      <Text style={[styles.chainChipTxt, companyChainOnly && styles.chainChipTxtOn]}>My company chain</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            {user?.role === "retail" ? (
              <View style={[styles.garageSellCard, shadows.card]}>
                <Text style={styles.garageSellTitle}>Garage — sell & supply</Text>
                <Text style={styles.garageSellBody}>
                  Buy parts from listings below; post your own SKUs so distributors and buyers can order from you. Chat from any
                  product to negotiate — Dealer map helps you find suppliers.
                </Text>
                <Pressable style={styles.garageSellBtn} onPress={() => navigation.getParent()?.getParent()?.navigate("PostProduct")}>
                  <Text style={styles.garageSellBtnTxt}>Post marketplace listing</Text>
                </Pressable>
              </View>
            ) : null}
          </>
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
  supplyCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
    marginBottom: 12,
  },
  supplyTitle: { fontSize: 17, fontWeight: "800", color: colors.header, marginBottom: 6 },
  supplyFlow: { fontSize: 13, fontWeight: "700", color: colors.secondaryBlue, marginBottom: 8 },
  supplyBody: { color: colors.textSecondary, lineHeight: 20, fontSize: 14, marginBottom: 12 },
  shortcutRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shortcut: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.selectionBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
  },
  shortcutTxt: { fontWeight: "800", color: colors.header, fontSize: 13 },
  chainRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chainChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chainChipOn: { borderColor: colors.secondaryBlue, backgroundColor: colors.selectionBg },
  chainChipTxt: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  chainChipTxtOn: { color: colors.header },
  garageSellCard: {
    backgroundColor: "#F5F0EB",
    borderRadius: radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cta,
    marginBottom: 12,
  },
  garageSellTitle: { fontSize: 16, fontWeight: "800", color: colors.header, marginBottom: 6 },
  garageSellBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  garageSellBtn: { alignSelf: "flex-start", backgroundColor: colors.cta, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12 },
  garageSellBtnTxt: { color: colors.white, fontWeight: "800", fontSize: 14 },
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
