import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows, radii } from "../theme";

export function AdminCouponsScreen() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("100");
  const [discount, setDiscount] = useState("0");
  const [maxUses, setMaxUses] = useState("500");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.couponsList();
      setCoupons(data.coupons || []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const create = async () => {
    if (!code.trim()) return Alert.alert("Code", "Required");
    setBusy(true);
    try {
      await adminApi.createCoupon({
        code: code.trim(),
        title: title.trim(),
        pointsValue: Number(points) || 0,
        discountPercent: Number(discount) || 0,
        maxUses: Number(maxUses) || 100,
      });
      setModal(false);
      setCode("");
      setTitle("");
      setPoints("100");
      setDiscount("0");
      setMaxUses("500");
      await load();
    } catch (e) {
      Alert.alert("Create", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c) => {
    try {
      await adminApi.patchCoupon(c._id, { active: !c.active });
      await load();
    } catch (e) {
      Alert.alert("Update", e.response?.data?.error || e.message);
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={coupons}
        keyExtractor={(c) => c._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListHeaderComponent={
          <Text style={styles.lead}>Create promo codes — users earn points when they redeem (once per user per code).</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "…" : "No coupons yet."}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.meta}>
              {item.title || "—"} · {item.pointsValue} pts · {item.discountPercent}% label · uses {item.usesCount}/{item.maxUses}
            </Text>
            <Text style={styles.meta}>{item.active ? "Active" : "Inactive"}</Text>
            <Pressable onPress={() => toggle(item)} style={styles.toggle}>
              <Text style={styles.toggleTxt}>{item.active ? "Deactivate" : "Activate"}</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      />
      <Pressable style={styles.fab} onPress={() => setModal(true)}>
        <Text style={styles.fabTxt}>+ New coupon</Text>
      </Pressable>
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New coupon</Text>
            <Text style={styles.label}>Code *</Text>
            <TextInput value={code} onChangeText={setCode} style={styles.input} autoCapitalize="characters" placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Points value</Text>
            <TextInput value={points} onChangeText={setPoints} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Discount % (display)</Text>
            <TextInput value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Max uses</Text>
            <TextInput value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <View style={styles.rowBtn}>
              <Pressable onPress={() => setModal(false)} style={styles.ghost}>
                <Text style={styles.ghostTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={create} disabled={busy} style={styles.primary}>
                <Text style={styles.primaryTxt}>{busy ? "…" : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  lead: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
  card: { padding: 14, borderRadius: radii.card, marginBottom: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  code: { fontSize: 18, fontWeight: "800", color: colors.header },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  toggle: { marginTop: 10, alignSelf: "flex-start" },
  toggleTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  fab: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  fabTxt: { color: colors.white, fontWeight: "800", fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.header, marginBottom: 8 },
  label: { marginTop: 10, fontWeight: "600", color: colors.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 6, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  rowBtn: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  ghost: { padding: 12 },
  ghostTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  primary: { backgroundColor: colors.cta, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  primaryTxt: { color: colors.white, fontWeight: "800" },
});
