import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

function newLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeTotals(lineItems, taxPercent) {
  let subtotal = 0;
  for (const li of lineItems) {
    const q = Number(li.quantity) || 0;
    const p = Number(li.unitPrice) || 0;
    subtotal += q * p;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const tax = Math.round(subtotal * ((Number(taxPercent) || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

function estimateShareText(est) {
  const lines = (est.lineItems || [])
    .map((li) => `• ${li.kind === "service" ? "Service" : "Part"}: ${li.description} × ${li.quantity} @ ₹${li.unitPrice}`)
    .join("\n");
  return `Hornvin Garage — Estimate${est.title ? `: ${est.title}` : ""}\n\n${lines || "(no lines)"}\n\nSubtotal ₹${est.subtotal}\nTax (${est.taxPercent || 0}%) ₹${est.tax}\nTotal ₹${est.total}`;
}

export function GarageWorkEstimateScreen() {
  const [estimateId, setEstimateId] = useState(null);
  const [estimateStatus, setEstimateStatus] = useState("draft");
  const [title, setTitle] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");
  const [lineItems, setLineItems] = useState([
    { localId: newLineId(), kind: "service", description: "Labor — general service", quantity: "2", unitPrice: "800" },
    { localId: newLineId(), kind: "part", description: "Oil filter + consumables", quantity: "1", unitPrice: "1200" },
  ]);
  const [garageCustomerId, setGarageCustomerId] = useState("");
  const [garageVehicleId, setGarageVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [pickVehicle, setPickVehicle] = useState(false);
  const [quickResult, setQuickResult] = useState(null);

  const payloadLineItems = lineItems.map((li) => ({
    kind: li.kind,
    description: String(li.description || "").trim() || "Line",
    quantity: Math.max(0.01, Number(li.quantity) || 0.01),
    unitPrice: Math.max(0, Number(li.unitPrice) || 0),
  }));

  const totals = computeTotals(
    lineItems.map((li) => ({ quantity: li.quantity, unitPrice: li.unitPrice })),
    taxPercent
  );

  const loadSideData = async () => {
    try {
      const [cRes, eRes] = await Promise.all([garageApi.customersList(), garageApi.estimatesList()]);
      setCustomers(cRes.data.customers || []);
      setEstimates(eRes.data.estimates || []);
    } catch {
      setCustomers([]);
      setEstimates([]);
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

  useFocusEffect(
    useCallback(() => {
      loadSideData();
    }, [])
  );

  const addLine = (kind) => {
    setLineItems((prev) => [...prev, { localId: newLineId(), kind, description: "", quantity: "1", unitPrice: "0" }]);
  };

  const updateLine = (localId, patch) => {
    setLineItems((prev) => prev.map((li) => (li.localId === localId ? { ...li, ...patch } : li)));
  };

  const removeLine = (localId) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.localId !== localId)));
  };

  const selectCustomer = (c) => {
    setGarageCustomerId(c._id);
    setCustomerName(c.name || "");
    setGarageVehicleId("");
    setPickCustomer(false);
    loadVehicles(c._id);
  };

  const selectVehicle = (v) => {
    setGarageVehicleId(v._id);
    setPickVehicle(false);
  };

  const clearCustomerVehicle = () => {
    setGarageCustomerId("");
    setGarageVehicleId("");
    setCustomerName("");
    setVehicles([]);
  };

  const applyEstimate = (est) => {
    setEstimateId(est._id);
    setEstimateStatus(est.status || "draft");
    setTitle(est.title || "");
    setTaxPercent(String(est.taxPercent ?? 0));
    setGarageCustomerId(est.garageCustomerId ? String(est.garageCustomerId) : "");
    setGarageVehicleId(est.garageVehicleId ? String(est.garageVehicleId) : "");
    setLineItems(
      (est.lineItems || []).map((li) => ({
        localId: newLineId(),
        kind: li.kind === "part" ? "part" : "service",
        description: li.description || "",
        quantity: String(li.quantity ?? 1),
        unitPrice: String(li.unitPrice ?? 0),
      }))
    );
    if (est.garageCustomerId) loadVehicles(String(est.garageCustomerId));
    const c = customers.find((x) => String(x._id) === String(est.garageCustomerId));
    setCustomerName(c?.name || "");
  };

  const newEstimate = () => {
    setEstimateId(null);
    setEstimateStatus("draft");
    setTitle("");
    setTaxPercent("18");
    setGarageCustomerId("");
    setGarageVehicleId("");
    setCustomerName("");
    setVehicles([]);
    setLineItems([{ localId: newLineId(), kind: "service", description: "", quantity: "1", unitPrice: "0" }]);
  };

  const saveEstimate = async (status) => {
    if (estimateStatus === "converted") {
      Alert.alert("Estimate", "This estimate is already converted to an invoice.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        taxPercent: Number(taxPercent) || 0,
        lineItems: payloadLineItems,
        status: status === "sent" ? "sent" : "draft",
        garageCustomerId: garageCustomerId || undefined,
        garageVehicleId: garageVehicleId || undefined,
      };
      if (estimateId) {
        await garageApi.estimatePatch(estimateId, body);
      } else {
        const { data } = await garageApi.estimateCreate(body);
        setEstimateId(data.estimate._id);
        setEstimateStatus(data.estimate.status || "draft");
      }
      Alert.alert("Saved", status === "sent" ? "Estimate marked as sent." : "Draft saved.");
      await loadSideData();
    } catch (e) {
      Alert.alert("Save", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = async () => {
    const est = {
      title: title.trim(),
      lineItems: payloadLineItems,
      taxPercent: Number(taxPercent) || 0,
      ...computeTotals(
        lineItems.map((li) => ({ quantity: li.quantity, unitPrice: li.unitPrice })),
        taxPercent
      ),
    };
    const text = estimateShareText(est);
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else await Share.share({ message: text });
  };

  const convertInvoice = async () => {
    if (!estimateId) {
      Alert.alert("Invoice", "Save the estimate first, then convert.");
      return;
    }
    if (estimateStatus === "converted") return;
    setSaving(true);
    try {
      const { data } = await garageApi.estimateConvertInvoice(estimateId);
      Alert.alert("Invoice", `Created ${data.invoice?.number || "invoice"}. Open Shop invoices to share or set payment.`);
      setEstimateStatus("converted");
      await loadSideData();
    } catch (e) {
      Alert.alert("Convert", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const quickCalc = async () => {
    setLoading(true);
    setQuickResult(null);
    try {
      const laborLine = lineItems.find((l) => l.kind === "service");
      const partsCost = lineItems
        .filter((l) => l.kind === "part")
        .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
      const { data } = await garageApi.workEstimate({
        laborHours: Number(laborLine?.quantity) || 0,
        laborRate: Number(laborLine?.unitPrice) || 0,
        partsCost: Math.round(partsCost * 100) / 100,
        taxPercent: Number(taxPercent) || 0,
      });
      setQuickResult(data);
    } catch (e) {
      Alert.alert("Quick calc", e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const readOnly = estimateStatus === "converted";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Work estimation</Text>
      <Text style={styles.sub}>Add services and parts as lines, tax auto-calculates. Save drafts, share on WhatsApp, convert to a shop invoice.</Text>

      <View style={[styles.card, shadows.card]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Current estimate</Text>
          {readOnly ? <Text style={styles.badge}>Converted</Text> : estimateStatus === "sent" ? <Text style={styles.badgeSent}>Sent</Text> : <Text style={styles.badgeDraft}>Draft</Text>}
        </View>
        <Text style={styles.label}>Title (optional)</Text>
        <TextInput value={title} onChangeText={setTitle} editable={!readOnly} style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Customer & vehicle (optional)</Text>
        <View style={styles.linkRow}>
          <Pressable style={styles.linkBtn} onPress={() => !readOnly && setPickCustomer(true)} disabled={readOnly}>
            <Text style={styles.linkBtnTxt}>{garageCustomerId ? customerName || "Customer" : "Pick customer"}</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => !readOnly && garageCustomerId && setPickVehicle(true)} disabled={readOnly || !garageCustomerId}>
            <Text style={styles.linkBtnTxt}>{garageVehicleId ? "Vehicle selected" : "Pick vehicle"}</Text>
          </Pressable>
          {(garageCustomerId || garageVehicleId) && !readOnly ? (
            <Pressable onPress={clearCustomerVehicle}>
              <Text style={styles.clearTxt}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.label}>Tax %</Text>
        <TextInput value={taxPercent} onChangeText={setTaxPercent} editable={!readOnly} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />

        <Text style={[styles.label, { marginTop: 14 }]}>Lines</Text>
        {lineItems.map((li) => (
          <View key={li.localId} style={styles.lineCard}>
            <View style={styles.kindRow}>
              <Pressable onPress={() => !readOnly && updateLine(li.localId, { kind: "service" })} style={[styles.kindChip, li.kind === "service" && styles.kindChipOn]}>
                <Text style={[styles.kindChipTxt, li.kind === "service" && styles.kindChipTxtOn]}>Service</Text>
              </Pressable>
              <Pressable onPress={() => !readOnly && updateLine(li.localId, { kind: "part" })} style={[styles.kindChip, li.kind === "part" && styles.kindChipOn]}>
                <Text style={[styles.kindChipTxt, li.kind === "part" && styles.kindChipTxtOn]}>Part</Text>
              </Pressable>
              {!readOnly ? (
                <Pressable onPress={() => removeLine(li.localId)} style={{ marginLeft: "auto" }}>
                  <Text style={styles.removeTxt}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={li.description}
              onChangeText={(t) => updateLine(li.localId, { description: t })}
              editable={!readOnly}
              placeholder="Description"
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.qtyRow}>
              <TextInput
                value={li.quantity}
                onChangeText={(t) => updateLine(li.localId, { quantity: t })}
                editable={!readOnly}
                keyboardType="decimal-pad"
                style={[styles.input, styles.qtyIn]}
                placeholder="Qty"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                value={li.unitPrice}
                onChangeText={(t) => updateLine(li.localId, { unitPrice: t })}
                editable={!readOnly}
                keyboardType="decimal-pad"
                style={[styles.input, styles.priceIn]}
                placeholder="₹ unit"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        ))}
        {!readOnly ? (
          <View style={styles.addRow}>
            <Pressable style={styles.addBtn} onPress={() => addLine("service")}>
              <Text style={styles.addBtnTxt}>+ Service</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={() => addLine("part")}>
              <Text style={styles.addBtnTxt}>+ Part</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.totalsBox}>
          <Row label="Subtotal" value={`₹${totals.subtotal}`} />
          <Row label={`Tax (${taxPercent || 0}%)`} value={`₹${totals.tax}`} />
          <View style={styles.divider} />
          <Row label="Total" value={`₹${totals.total}`} bold />
        </View>

        {!readOnly ? (
          <View style={styles.actions}>
            <Pressable onPress={() => saveEstimate("draft")} style={styles.primary} disabled={saving}>
              <Text style={styles.primaryTxt}>{saving ? "…" : estimateId ? "Update draft" : "Save draft"}</Text>
            </Pressable>
            <Pressable onPress={() => saveEstimate("sent")} style={styles.secondary} disabled={saving}>
              <Text style={styles.secondaryTxt}>Mark sent</Text>
            </Pressable>
            <Pressable onPress={shareWhatsApp} style={styles.wa}>
              <Text style={styles.waTxt}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={convertInvoice} style={styles.invoiceBtn} disabled={saving || !estimateId}>
              <Text style={styles.invoiceBtnTxt}>→ Invoice</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={quickCalc} style={styles.ghost} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.header} /> : <Text style={styles.ghostTxt}>Quick labor check (server)</Text>}
        </Pressable>
        {quickResult ? (
          <Text style={styles.quickHint}>
            Server check: labor ₹{quickResult.laborSubtotal} + parts lump ₹{quickResult.partsCost} → total ₹{quickResult.total} (compare with your lines).
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Recent estimates</Text>
      {estimates.length === 0 ? (
        <Text style={styles.empty}>No saved estimates yet.</Text>
      ) : (
        estimates.slice(0, 12).map((item) => (
          <Pressable key={item._id} style={[styles.miniCard, shadows.card]} onPress={() => applyEstimate(item)}>
            <Text style={styles.miniTitle}>{item.title || "Untitled"} · ₹{item.total}</Text>
            <Text style={styles.miniMeta}>{item.status}</Text>
          </Pressable>
        ))
      )}

      <Pressable onPress={newEstimate} style={styles.newEst}>
        <Text style={styles.newEstTxt}>+ New blank estimate</Text>
      </Pressable>

      <FooterCredit />

      <Modal visible={pickCustomer} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select customer</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {customers.map((c) => (
                <Pressable key={c._id} style={styles.optRow} onPress={() => selectCustomer(c)}>
                  <Text style={styles.optName}>{c.name}</Text>
                  <Text style={styles.optPhone}>{c.phone || "—"}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickCustomer(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={pickVehicle} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select vehicle</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {vehicles.map((v) => (
                <Pressable key={v._id} style={styles.optRow} onPress={() => selectVehicle(v)}>
                  <Text style={styles.optName}>{v.plateNumber}</Text>
                  <Text style={styles.optPhone}>{v.model || "—"}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickVehicle(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: "700", color: colors.header, fontSize: 15 },
  rowBetween: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  badge: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, backgroundColor: colors.selectionBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSent: { fontSize: 11, fontWeight: "800", color: "#166534", backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeDraft: { fontSize: 11, fontWeight: "800", color: colors.header, backgroundColor: colors.selectionBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
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
  linkRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.selectionBg, borderRadius: 10, borderWidth: 1, borderColor: colors.selectionBorder },
  linkBtnTxt: { fontWeight: "700", color: colors.header, fontSize: 13 },
  clearTxt: { color: colors.error, fontWeight: "600", fontSize: 13 },
  lineCard: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  kindRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  kindChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  kindChipOn: { backgroundColor: colors.header, borderColor: colors.header },
  kindChipTxt: { fontSize: 12, fontWeight: "700", color: colors.text },
  kindChipTxtOn: { color: colors.white },
  removeTxt: { color: colors.error, fontWeight: "600", fontSize: 13 },
  qtyRow: { flexDirection: "row", gap: 8 },
  qtyIn: { flex: 1 },
  priceIn: { flex: 1 },
  addRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  addBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.secondaryBlue },
  addBtnTxt: { fontWeight: "800", color: colors.secondaryBlue },
  totalsBox: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  bold: { fontWeight: "800", color: colors.header, fontSize: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  actions: { marginTop: 16, gap: 10 },
  primary: { backgroundColor: colors.cta, paddingVertical: 14, borderRadius: radii.button, alignItems: "center" },
  primaryTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondary: { paddingVertical: 12, alignItems: "center", borderRadius: radii.button, borderWidth: 1, borderColor: colors.cta },
  secondaryTxt: { color: colors.cta, fontWeight: "700" },
  wa: { paddingVertical: 12, alignItems: "center", borderRadius: radii.button, backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC" },
  waTxt: { color: "#166534", fontWeight: "800" },
  invoiceBtn: { paddingVertical: 12, alignItems: "center", borderRadius: radii.button, backgroundColor: colors.header },
  invoiceBtnTxt: { color: colors.white, fontWeight: "800" },
  ghost: { marginTop: 14, alignItems: "center", padding: 10 },
  ghostTxt: { color: colors.secondaryBlue, fontWeight: "600" },
  quickHint: { marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.header, marginBottom: 10 },
  miniCard: { padding: 12, borderRadius: radii.card, backgroundColor: colors.card, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  miniTitle: { fontWeight: "700", color: colors.text },
  miniMeta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { color: colors.textSecondary, marginBottom: 12 },
  newEst: { marginTop: 8, marginBottom: 20, alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.selectionBg, borderRadius: 12, borderWidth: 1, borderColor: colors.selectionBorder },
  newEstTxt: { fontWeight: "800", color: colors.secondaryBlue },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.header, marginBottom: 12 },
  optRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optName: { fontSize: 16, fontWeight: "700", color: colors.text },
  optPhone: { marginTop: 4, fontSize: 13, color: colors.textSecondary },
  modalClose: { marginTop: 16, alignItems: "center", padding: 12 },
  modalCloseTxt: { color: colors.secondaryBlue, fontWeight: "800" },
});
