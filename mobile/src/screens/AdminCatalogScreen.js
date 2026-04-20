import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminCatalogScreen() {
  const [products, setProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");

  const load = useCallback(async () => {
    const { data } = await adminApi.listGlobalProducts();
    setProducts(data.products || []);
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

  const create = async () => {
    const pr = parseFloat(price);
    const q = parseInt(qty, 10);
    if (!name.trim() || !category.trim() || Number.isNaN(pr) || Number.isNaN(q)) {
      return Alert.alert("Form", "Name, category, valid price and quantity required");
    }
    try {
      await adminApi.createGlobalProduct({
        name: name.trim(),
        category: category.trim(),
        price: pr,
        quantity: q,
        description: "",
      });
      setName("");
      setCategory("");
      setPrice("");
      setQty("");
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const remove = (id) => {
    Alert.alert("Delete product", "Remove this global SKU?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await adminApi.deleteGlobalProduct(id);
            await load();
          } catch (e) {
            Alert.alert("Error", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.list}
      data={products}
      keyExtractor={(p) => String(p._id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={[styles.form, shadows.card]}>
          <Text style={styles.h2}>Add global product</Text>
          <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
          <TextInput style={styles.input} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <TextInput style={styles.input} placeholder="Quantity" value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <Pressable onPress={create} style={styles.cta}>
            <Text style={styles.ctaText}>Publish to catalog</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item: p }) => (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.pname}>{p.name}</Text>
          <Text style={styles.pmeta}>
            {p.category} · ₹{p.price} · stock {p.quantity}
          </Text>
          <Pressable onPress={() => remove(p._id)} style={styles.del}>
            <Text style={styles.delTxt}>Delete</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No global products yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  form: { padding: 14, marginBottom: 16, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  h2: { fontWeight: "800", fontSize: 16, marginBottom: 10, color: colors.header },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  cta: { marginTop: 8, backgroundColor: colors.cta, padding: 14, borderRadius: 12, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800" },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  pname: { fontSize: 16, fontWeight: "800" },
  pmeta: { marginTop: 4, color: colors.textSecondary },
  del: { marginTop: 10, alignSelf: "flex-start" },
  delTxt: { color: colors.error, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, color: colors.textSecondary },
});
