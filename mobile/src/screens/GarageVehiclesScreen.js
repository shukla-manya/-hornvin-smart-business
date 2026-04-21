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
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

export function GarageVehiclesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const customerId = route.params?.customerId;
  const customerName = route.params?.customerName;

  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (!customerId) {
        const { data } = await garageApi.customersList();
        setCustomers(data.customers || []);
        setVehicles([]);
      } else {
        const { data } = await garageApi.vehiclesList(customerId);
        setVehicles(data.vehicles || []);
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [customerId])
  );

  const saveVehicle = async () => {
    if (!customerId) return;
    if (!plate.trim()) return Alert.alert("Vehicle", "Enter registration / plate number.");
    setSaving(true);
    try {
      await garageApi.vehicleCreate(customerId, { plateNumber: plate.trim(), model: model.trim(), notes: notes.trim() });
      setModal(false);
      setPlate("");
      setModel("");
      setNotes("");
      await load();
    } catch (e) {
      Alert.alert("Save", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeV = (v) => {
    Alert.alert("Remove vehicle", `Remove ${v.plateNumber}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await garageApi.vehicleDelete(v._id);
            await load();
          } catch (e) {
            Alert.alert("Remove", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  if (!customerId) {
    return (
      <View style={styles.root}>
        <Text style={styles.h1}>Vehicle management</Text>
        <Text style={styles.sub}>Pick a customer to add or edit vehicles (number, model). Service records can link to a vehicle.</Text>
        <FlatList
          data={customers}
          keyExtractor={(c) => c._id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
          ListEmptyComponent={
            loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} /> : <Text style={styles.empty}>No customers yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, shadows.card]}
              onPress={() => navigation.navigate("GarageVehicles", { customerId: item._id, customerName: item.name })}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.phone || "—"}</Text>
              <Text style={styles.chev}>Vehicles ›</Text>
            </Pressable>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
        <FooterCredit />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Vehicles</Text>
      <Text style={styles.sub}>{customerName || "Customer"} — number, model, notes. Link service jobs from Service history.</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(v) => v._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} /> : <Text style={styles.empty}>No vehicles yet — add one.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.plate}>{item.plateNumber}</Text>
            {item.model ? <Text style={styles.meta}>{item.model}</Text> : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            <Pressable onPress={() => removeV(item)} style={styles.del}>
              <Text style={styles.delTxt}>Remove</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListFooterComponent={<FooterCredit />}
      />
      <Pressable style={[styles.fab, { bottom: 16 + insets.bottom }]} onPress={() => setModal(true)}>
        <Text style={styles.fabTxt}>+ Link vehicle</Text>
      </Pressable>
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add vehicle</Text>
            <Text style={styles.label}>Vehicle number (plate) *</Text>
            <TextInput value={plate} onChangeText={setPlate} autoCapitalize="characters" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Model</Text>
            <TextInput value={model} onChangeText={setModel} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)} style={styles.btnGhost}>
                <Text style={styles.btnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveVehicle} style={styles.btnPrimary} disabled={saving}>
                <Text style={styles.btnPrimaryTxt}>{saving ? "…" : "Save"}</Text>
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
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  plate: { fontSize: 18, fontWeight: "800", color: colors.header },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  notes: { marginTop: 8, color: colors.text, fontSize: 13 },
  chev: { marginTop: 8, color: colors.secondaryBlue, fontWeight: "700" },
  del: { marginTop: 10, alignSelf: "flex-start" },
  delTxt: { color: colors.error, fontWeight: "600" },
  fab: {
    position: "absolute",
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.header, marginBottom: 8 },
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
