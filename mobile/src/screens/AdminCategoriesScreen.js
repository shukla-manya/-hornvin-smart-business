import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminCategoriesScreen() {
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const { data } = await adminApi.categories();
    setCategories(data.categories || []);
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

  const add = async () => {
    if (!name.trim()) return;
    try {
      await adminApi.postCategory({ name: name.trim() });
      setName("");
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const toggle = async (c) => {
    try {
      await adminApi.patchCategory(c._id, { active: !c.active });
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const del = (c) => {
    Alert.alert("Remove category", c.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await adminApi.deleteCategory(c._id);
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
      data={categories}
      keyExtractor={(c) => String(c._id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={[styles.form, shadows.card]}>
          <Text style={styles.h2}>New category</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Name" value={name} onChangeText={setName} />
            <Pressable onPress={add} style={styles.cta}>
              <Text style={styles.ctaText}>Add</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item: c }) => (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cname}>{c.name}</Text>
          <Text style={styles.cmeta}>Order {c.sortOrder} · {c.active ? "Active" : "Hidden"}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => toggle(c)} style={styles.btn}>
              <Text style={styles.btnTxt}>{c.active ? "Deactivate" : "Activate"}</Text>
            </Pressable>
            <Pressable onPress={() => del(c)} style={styles.btn}>
              <Text style={[styles.btnTxt, { color: colors.error }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No categories — add names used in products</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  form: { padding: 14, marginBottom: 16, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  h2: { fontWeight: "800", fontSize: 16, marginBottom: 10, color: colors.header },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  cta: { backgroundColor: colors.secondaryBlue, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  ctaText: { color: colors.white, fontWeight: "800" },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  cname: { fontSize: 16, fontWeight: "800" },
  cmeta: { marginTop: 4, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  btn: { paddingVertical: 6 },
  btnTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, color: colors.textSecondary },
});
