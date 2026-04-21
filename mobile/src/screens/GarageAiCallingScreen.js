import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";

export function GarageAiCallingScreen() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState({});
  const [purpose, setPurpose] = useState("service_due");
  const [batchItems, setBatchItems] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [topic, setTopic] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [script, setScript] = useState("");
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      const { data } = await garageApi.customersList();
      setCustomers(data.customers || []);
    } catch {
      setCustomers([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  const toggleSel = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedIds = () => Object.keys(selected).filter((k) => selected[k]);

  const runBatch = async () => {
    const ids = selectedIds();
    if (!ids.length) {
      Alert.alert("Customers", "Select at least one customer.");
      return;
    }
    setBatchLoading(true);
    setBatchItems([]);
    try {
      const { data } = await garageApi.aiCallBatch({ customerIds: ids, purpose });
      setBatchItems(data.items || []);
    } catch (e) {
      Alert.alert("Batch", e.response?.data?.error || e.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    setScript("");
    setTips([]);
    try {
      const { data } = await garageApi.aiCallScript({
        customerName: customerName.trim(),
        topic: topic.trim(),
        vehicle: vehicle.trim(),
        purpose: topic.trim() ? "custom" : purpose,
      });
      setScript(data.script || "");
      setTips(data.tips || []);
    } catch (e) {
      Alert.alert("Generate", e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const shareOut = async (msg) => {
    if (!msg) return;
    try {
      await Share.share({ message: msg });
    } catch {
      /* dismissed */
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>AI call assistant</Text>
      <Text style={styles.sub}>
        Select customers for outbound batches (service due vs offers), or generate a one-off script. Templates only — plug in your LLM or dialer on the server later.
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Batch — select customers</Text>
        <View style={styles.purposeRow}>
          <Pressable onPress={() => setPurpose("service_due")} style={[styles.purposeChip, purpose === "service_due" && styles.purposeOn]}>
            <Text style={[styles.purposeTxt, purpose === "service_due" && styles.purposeTxtOn]}>Service due</Text>
          </Pressable>
          <Pressable onPress={() => setPurpose("offers")} style={[styles.purposeChip, purpose === "offers" && styles.purposeOn]}>
            <Text style={[styles.purposeTxt, purpose === "offers" && styles.purposeTxtOn]}>Offers</Text>
          </Pressable>
        </View>
        <View style={styles.custList}>
          {customers.length === 0 ? (
            <Text style={styles.muted}>No customers — add them under Customers.</Text>
          ) : (
            customers.map((item) => {
              const on = !!selected[item._id];
              return (
                <Pressable key={item._id} onPress={() => toggleSel(item._id)} style={[styles.custRow, on && styles.custRowOn]}>
                  <Text style={styles.custCheck}>{on ? "☑" : "☐"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{item.name}</Text>
                    <Text style={styles.custPhone}>{item.phone || "—"}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
        <Pressable onPress={runBatch} style={styles.primary} disabled={batchLoading}>
          {batchLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryTxt}>Generate scripts for selection</Text>}
        </Pressable>
      </View>

      {batchItems.length ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Batch scripts</Text>
          {batchItems.map((row) => (
            <View key={row.customerId} style={styles.batchBlock}>
              <Text style={styles.batchName}>{row.name}</Text>
              {row.phone ? <Text style={styles.batchPhone}>{row.phone}</Text> : null}
              <Text style={styles.script}>{row.script}</Text>
              <Pressable onPress={() => shareOut(row.script)} style={styles.secondary}>
                <Text style={styles.secondaryTxt}>Share</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>One-off script</Text>
        <Text style={styles.label}>Customer name</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Rajesh" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Topic (optional — if set, uses custom template)</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="Follow-up after brake inspection quote"
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Vehicle (optional)</Text>
        <TextInput value={vehicle} onChangeText={setVehicle} placeholder="2022 City ZX — KA01 AB 1234" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Pressable onPress={generate} style={styles.primary} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryTxt}>Generate script</Text>}
        </Pressable>
      </View>

      {script ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Script</Text>
          <Text style={styles.script}>{script}</Text>
          <Pressable onPress={() => shareOut(script)} style={styles.secondary}>
            <Text style={styles.secondaryTxt}>Share script</Text>
          </Pressable>
        </View>
      ) : null}

      {tips.length ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Checklist</Text>
          {tips.map((t, i) => (
            <Text key={i} style={styles.tip}>
              • {t}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
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
  cardTitle: { fontWeight: "700", color: colors.header, marginBottom: 12, fontSize: 15 },
  purposeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  purposeChip: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  purposeOn: { backgroundColor: colors.header, borderColor: colors.header },
  purposeTxt: { fontWeight: "700", color: colors.text, fontSize: 13 },
  purposeTxtOn: { color: colors.white },
  custList: { maxHeight: 240 },
  custRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  custRowOn: { backgroundColor: colors.selectionBg, borderColor: colors.selectionBorder },
  custCheck: { fontSize: 18, marginRight: 10, color: colors.header },
  custName: { fontWeight: "700", color: colors.text },
  custPhone: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  muted: { color: colors.textSecondary, marginBottom: 8 },
  batchBlock: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  batchName: { fontWeight: "800", color: colors.header },
  batchPhone: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
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
  primary: {
    marginTop: 14,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  primaryTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  script: { color: colors.text, fontSize: 15, lineHeight: 24 },
  secondary: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.selectionBg, borderRadius: 12, borderWidth: 1, borderColor: colors.selectionBorder },
  secondaryTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  tip: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 8 },
});
