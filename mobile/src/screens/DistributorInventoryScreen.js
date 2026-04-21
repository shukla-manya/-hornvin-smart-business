import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { productsApi } from "../api/resources";
import { colors, shadows } from "../theme";

const LOW_STOCK_AT = 5;

export function DistributorInventoryScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qtyDraft, setQtyDraft] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await productsApi.list({ sellerId: String(user.id) });
      const list = (data.products || []).filter((p) => !p.isGlobalCatalog);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveQty = async (productId) => {
    const q = Number(qtyDraft);
    if (!Number.isFinite(q) || q < 0) {
      Alert.alert("Quantity", "Enter a valid number (0 or more).");
      return;
    }
    try {
      await productsApi.update(productId, { quantity: Math.floor(q) });
      setEditingId(null);
      setQtyDraft("");
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.banner}>
        Your marketplace SKUs (not Hornvin global rows). Tap quantity to adjust; ≤{LOW_STOCK_AT} units shows a low-stock hint.
      </Text>
      <Pressable onPress={() => navigation.navigate("PostProduct")} style={styles.addCta}>
        <Text style={styles.addCtaTxt}>+ Add custom product</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(p) => String(p._id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} />
          ) : (
            <Text style={styles.empty}>No distributor-owned products yet. Add listings from the button above or Post product.</Text>
          )
        }
        renderItem={({ item: p }) => {
          const low = (p.quantity ?? 0) <= LOW_STOCK_AT;
          const isEdit = editingId === p._id;
          return (
            <View style={[styles.card, shadows.card, low && styles.cardLow]}>
              <Text style={styles.title}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.category} · ₹{p.price}
                {low ? " · Low stock" : ""}
              </Text>
              {isEdit ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={qtyDraft}
                    onChangeText={setQtyDraft}
                    placeholder="Qty"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Pressable onPress={() => saveQty(p._id)} style={styles.saveBtn}>
                    <Text style={styles.saveBtnTxt}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingId(null)} style={styles.cancelBtn}>
                    <Text style={styles.cancelTxt}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setEditingId(p._id);
                    setQtyDraft(String(p.quantity ?? 0));
                  }}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnTxt}>Stock: {p.quantity ?? 0} (tap to edit)</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  banner: { padding: 12, backgroundColor: colors.selectionBg, color: colors.header, fontSize: 13, lineHeight: 19 },
  addCta: { margin: 12, backgroundColor: colors.cta, padding: 14, borderRadius: 12, alignItems: "center" },
  addCtaTxt: { color: colors.white, fontWeight: "800" },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  cardLow: { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  qtyBtn: { marginTop: 10, alignSelf: "flex-start" },
  qtyBtnTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  editRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, width: 100, fontSize: 16 },
  saveBtn: { backgroundColor: colors.secondaryBlue, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  saveBtnTxt: { color: colors.white, fontWeight: "800" },
  cancelBtn: { paddingHorizontal: 10 },
  cancelTxt: { color: colors.textSecondary },
  empty: { textAlign: "center", marginTop: 32, color: colors.textSecondary, paddingHorizontal: 20 },
});
