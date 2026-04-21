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
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

export function GarageInventoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderAt, setReorderAt] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await garageApi.inventoryList();
      setItems(data.items || []);
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

  const openAdd = () => {
    setName("");
    setSku("");
    setQuantity("0");
    setReorderAt("0");
    setUnit("pcs");
    setNotes("");
    setModal(true);
  };

  const saveNew = async () => {
    if (!name.trim()) {
      Alert.alert("Name", "Enter a part or SKU name.");
      return;
    }
    setSaving(true);
    try {
      await garageApi.inventoryCreate({
        name: name.trim(),
        sku: sku.trim(),
        quantity: Number(quantity) || 0,
        reorderAt: Number(reorderAt) || 0,
        unit: unit.trim() || "pcs",
        notes: notes.trim(),
      });
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert("Save failed", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const bumpQty = async (item, delta) => {
    const next = Math.max(0, (item.quantity || 0) + delta);
    try {
      await garageApi.inventoryPatch(item._id, { quantity: next });
      await load();
    } catch (e) {
      Alert.alert("Update", e.response?.data?.error || e.message);
    }
  };

  const remove = (item) => {
    Alert.alert("Remove line", `Remove “${item.name}” from inventory?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await garageApi.inventoryDelete(item._id);
            await load();
          } catch (e) {
            Alert.alert("Remove", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  const low = (it) => (it.reorderAt || 0) > 0 && (it.quantity || 0) <= (it.reorderAt || 0);

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListHeaderComponent={
          <Text style={styles.lead}>Track parts on your shelf. When quantity hits the reorder level, restock from Explore or your company catalog.</Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} />
          ) : (
            <Text style={styles.empty}>No lines yet — add filters, oils, or tyres.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card, low(item) && styles.cardWarn]}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.name}</Text>
              {low(item) ? <Text style={styles.badge}>Reorder</Text> : null}
            </View>
            {item.sku ? <Text style={styles.meta}>SKU {item.sku}</Text> : null}
            <Text style={styles.meta}>
              {item.quantity} {item.unit || "pcs"}
              {(item.reorderAt || 0) > 0 ? ` · reorder ≤ ${item.reorderAt}` : ""}
            </Text>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.mini} onPress={() => bumpQty(item, -1)}>
                <Text style={styles.miniTxt}>−1</Text>
              </Pressable>
              <Pressable style={styles.mini} onPress={() => bumpQty(item, 1)}>
                <Text style={styles.miniTxt}>+1</Text>
              </Pressable>
              <Pressable style={styles.miniDanger} onPress={() => remove(item)}>
                <Text style={styles.miniDangerTxt}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      />
      <Pressable style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabTxt}>+ Add line</Text>
      </Pressable>
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New inventory line</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. 5W-30 synthetic 4L" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>SKU (optional)</Text>
            <TextInput value={sku} onChangeText={setSku} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Quantity</Text>
            <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Reorder at (optional)</Text>
            <TextInput value={reorderAt} onChangeText={setReorderAt} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Unit</Text>
            <TextInput value={unit} onChangeText={setUnit} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)} style={styles.btnGhost}>
                <Text style={styles.btnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveNew} style={styles.btnPrimary} disabled={saving}>
                <Text style={styles.btnPrimaryTxt}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <FooterCredit />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  lead: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWarn: { borderColor: colors.warning, backgroundColor: "#FFFBF0" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  badge: { fontSize: 11, fontWeight: "700", color: "#6B5416", backgroundColor: "#F8F1DC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  notes: { marginTop: 8, color: colors.text, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  mini: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.selectionBg, borderRadius: 10, borderWidth: 1, borderColor: colors.selectionBorder },
  miniTxt: { fontWeight: "700", color: colors.header },
  miniDanger: { paddingVertical: 8, paddingHorizontal: 12, marginLeft: "auto" },
  miniDangerTxt: { color: colors.error, fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 16,
    left: 16,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  fabTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.header, marginBottom: 12 },
  label: { marginTop: 10, fontWeight: "600", color: colors.textSecondary, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    padding: 12,
    marginTop: 6,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  btnGhostTxt: { color: colors.secondaryBlue, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.cta, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radii.button },
  btnPrimaryTxt: { color: colors.white, fontWeight: "700" },
});
