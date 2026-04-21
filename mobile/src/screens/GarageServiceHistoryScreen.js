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
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function GarageServiceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [garageCustomerId, setGarageCustomerId] = useState("");
  const [garageVehicleId, setGarageVehicleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: svc }, { data: cust }] = await Promise.all([garageApi.serviceList(), garageApi.customersList()]);
      setRecords(svc.records || []);
      setCustomers(cust.customers || []);
    } catch {
      setRecords([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async (cid) => {
    if (!cid) {
      setVehicles([]);
      return;
    }
    try {
      const { data } = await garageApi.vehiclesList(cid);
      setVehicles(data.vehicles || []);
    } catch {
      setVehicles([]);
    }
  };

  const pickCustomer = (c) => {
    setGarageCustomerId(c._id);
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setGarageVehicleId("");
    setVehiclePlate(c.vehiclePlate || "");
    setVehicleModel(c.vehicleModel || "");
    loadVehicles(c._id);
  };

  const pickVehicle = (v) => {
    setGarageVehicleId(v._id);
    setVehiclePlate(v.plateNumber || "");
    setVehicleModel(v.model || "");
  };

  const clearLinks = () => {
    setGarageCustomerId("");
    setGarageVehicleId("");
    setVehicles([]);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const save = async () => {
    if (!summary.trim()) {
      Alert.alert("Work summary", "Describe what was done on the vehicle.");
      return;
    }
    setSaving(true);
    try {
      await garageApi.serviceCreate({
        summary: summary.trim(),
        garageCustomerId: garageCustomerId || undefined,
        garageVehicleId: garageVehicleId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        odometerKm: odometerKm ? Number(odometerKm) : undefined,
        laborHours: laborHours ? Number(laborHours) : 0,
        partsUsed: partsUsed.trim(),
      });
      setModal(false);
      setSummary("");
      setGarageCustomerId("");
      setGarageVehicleId("");
      setVehicles([]);
      setCustomerName("");
      setCustomerPhone("");
      setVehiclePlate("");
      setVehicleModel("");
      setOdometerKm("");
      setLaborHours("");
      setPartsUsed("");
      await load();
    } catch (e) {
      Alert.alert("Save", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = (r) => {
    Alert.alert("Delete entry", "Remove this service record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await garageApi.serviceDelete(r._id);
            await load();
          } catch (e) {
            Alert.alert("Delete", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={records}
        keyExtractor={(r) => r._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListHeaderComponent={
          <Text style={styles.lead}>Immutable-style bay log: who came in, what you did, odometer, and parts — separate from marketplace orders.</Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} />
          ) : (
            <Text style={styles.empty}>No jobs logged yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.date}>{formatDate(item.performedAt)}</Text>
            <Text style={styles.summary}>{item.summary}</Text>
            <Text style={styles.meta}>
              {[item.customerName, item.vehiclePlate, item.vehicleModel].filter(Boolean).join(" · ") || "Walk-in / unassigned"}
            </Text>
            {item.odometerKm != null ? <Text style={styles.meta}>Odo {item.odometerKm} km</Text> : null}
            {item.laborHours ? <Text style={styles.meta}>Labor {item.laborHours} h</Text> : null}
            {item.partsUsed ? <Text style={styles.parts}>{item.partsUsed}</Text> : null}
            <Pressable onPress={() => del(item)} style={styles.del}>
              <Text style={styles.delTxt}>Delete</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 24 }}><FooterCredit /></View>}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      />
      <Pressable style={[styles.fab, { bottom: 16 + insets.bottom }]} onPress={() => setModal(true)}>
        <Text style={styles.fabTxt}>+ Log service</Text>
      </Pressable>
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>Log service</Text>
            <Text style={styles.label}>Work summary *</Text>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="e.g. Major service — filters, brake fluid, alignment check"
              style={[styles.input, { minHeight: 80 }]}
              multiline
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>Link customer (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <Pressable onPress={clearLinks} style={[styles.chip, !garageCustomerId && styles.chipOn]}>
                <Text style={[styles.chipTxt, !garageCustomerId && styles.chipTxtOn]}>Manual / walk-in</Text>
              </Pressable>
              {customers.map((c) => (
                <Pressable key={c._id} onPress={() => pickCustomer(c)} style={[styles.chip, garageCustomerId === c._id && styles.chipOn]}>
                  <Text style={[styles.chipTxt, garageCustomerId === c._id && styles.chipTxtOn]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Customer</Text>
            <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Phone</Text>
            <TextInput value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            {garageCustomerId && vehicles.length ? (
              <>
                <Text style={styles.label}>Link vehicle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <Pressable onPress={() => { setGarageVehicleId(""); }} style={[styles.chip, !garageVehicleId && styles.chipOn]}>
                    <Text style={[styles.chipTxt, !garageVehicleId && styles.chipTxtOn]}>Any / type below</Text>
                  </Pressable>
                  {vehicles.map((v) => (
                    <Pressable key={v._id} onPress={() => pickVehicle(v)} style={[styles.chip, garageVehicleId === v._id && styles.chipOn]}>
                      <Text style={[styles.chipTxt, garageVehicleId === v._id && styles.chipTxtOn]}>{v.plateNumber}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <Text style={styles.label}>Vehicle plate</Text>
            <TextInput value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Vehicle model</Text>
            <TextInput value={vehicleModel} onChangeText={setVehicleModel} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Odometer (km)</Text>
            <TextInput value={odometerKm} onChangeText={setOdometerKm} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Labor hours</Text>
            <TextInput value={laborHours} onChangeText={setLaborHours} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Parts / consumables used</Text>
            <TextInput value={partsUsed} onChangeText={setPartsUsed} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)} style={styles.btnGhost}>
                <Text style={styles.btnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save} style={styles.btnPrimary} disabled={saving}>
                <Text style={styles.btnPrimaryTxt}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  date: { fontSize: 12, fontWeight: "700", color: colors.secondaryBlue, marginBottom: 6 },
  summary: { fontSize: 16, fontWeight: "600", color: colors.text, lineHeight: 22 },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  parts: { marginTop: 8, color: colors.text, fontSize: 13, fontStyle: "italic" },
  del: { alignSelf: "flex-start", marginTop: 10 },
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
  modalScroll: { maxHeight: "88%" },
  modalCard: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.header, marginBottom: 8 },
  chipScroll: { marginTop: 6, marginBottom: 4, maxHeight: 44 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.header, borderColor: colors.header },
  chipTxt: { fontWeight: "700", fontSize: 13, color: colors.text },
  chipTxtOn: { color: colors.white },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20, marginBottom: 24 },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  btnGhostTxt: { color: colors.secondaryBlue, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.cta, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radii.button },
  btnPrimaryTxt: { color: colors.white, fontWeight: "700" },
});
