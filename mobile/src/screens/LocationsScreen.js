import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, TextInput, Alert, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { api } from "../services/api";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

export function LocationsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [label, setLabel] = useState("Saved location");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dealer-locator/locations");
      setItems(data.locations || []);
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

  const addCurrent = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location", "Permission required.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setBusy(true);
    try {
      await api.post("/dealer-locator/locations", {
        label: label.trim() || "Saved location",
        lat,
        lng,
        isPrimary: items.length === 0,
      });
      setModal(false);
      setLabel("Saved location");
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = async (id) => {
    try {
      await api.patch(`/dealer-locator/locations/${id}/primary`);
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const remove = (id) => {
    Alert.alert("Delete", "Remove this saved location?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/dealer-locator/locations/${id}`);
            await load();
          } catch (e) {
            Alert.alert("Error", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  const header = (
    <Pressable onPress={() => setModal(true)} style={styles.addBtn}>
      <Text style={styles.addBtnText}>Save current GPS as location</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(l) => l._id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : "No saved locations."}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.title}>{item.label}</Text>
            <Text style={styles.meta}>{item.address || "No address text"}</Text>
            <Text style={styles.meta}>
              {item.geo?.coordinates?.[1]?.toFixed(5)}, {item.geo?.coordinates?.[0]?.toFixed(5)}
              {item.isPrimary ? " · Primary" : ""}
            </Text>
            <View style={styles.row}>
              {!item.isPrimary ? (
                <Pressable onPress={() => makePrimary(item._id)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Set primary</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => remove(item._id)} style={styles.danger}>
                <Text style={styles.dangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={<FooterCredit />}
      />
      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Label</Text>
            <TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="e.g. Main shop" placeholderTextColor={colors.textSecondary} />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setModal(false)} style={styles.secondary}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={addCurrent} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
                <Text style={styles.ctaText}>Save</Text>
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
  addBtn: { backgroundColor: colors.secondaryBlue, padding: 12, borderRadius: 12, marginBottom: 12, alignItems: "center" },
  addBtnText: { color: colors.white, fontWeight: "800" },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  title: { fontWeight: "800", color: colors.text, fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  row: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  secondary: { borderWidth: 1, borderColor: colors.secondaryBlue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  secondaryText: { color: colors.secondaryBlue, fontWeight: "700" },
  danger: { borderWidth: 1, borderColor: colors.error, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#FEF2F2" },
  dangerText: { color: colors.error, fontWeight: "700" },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: "#0006", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  modalTitle: { fontWeight: "800", color: colors.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginBottom: 16 },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cta: { backgroundColor: colors.cta, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  ctaText: { color: colors.white, fontWeight: "800" },
});
