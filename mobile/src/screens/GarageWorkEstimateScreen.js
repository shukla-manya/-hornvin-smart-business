import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

export function GarageWorkEstimateScreen() {
  const [laborHours, setLaborHours] = useState("2");
  const [laborRate, setLaborRate] = useState("800");
  const [partsCost, setPartsCost] = useState("3500");
  const [taxPercent, setTaxPercent] = useState("18");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calc = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await garageApi.workEstimate({
        laborHours: Number(laborHours) || 0,
        laborRate: Number(laborRate) || 0,
        partsCost: Number(partsCost) || 0,
        taxPercent: Number(taxPercent) || 0,
      });
      setResult(data);
    } catch (e) {
      Alert.alert("Estimate", e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Work estimation</Text>
      <Text style={styles.sub}>Rough bay quote: labor hours × shop rate, add parts, apply GST/VAT-style tax. Customer sees a single total.</Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.label}>Labor hours</Text>
        <TextInput value={laborHours} onChangeText={setLaborHours} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Labor rate (₹ / hr)</Text>
        <TextInput value={laborRate} onChangeText={setLaborRate} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Parts & consumables (₹)</Text>
        <TextInput value={partsCost} onChangeText={setPartsCost} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Tax %</Text>
        <TextInput value={taxPercent} onChangeText={setTaxPercent} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Pressable onPress={calc} style={styles.primary} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryTxt}>Calculate</Text>}
        </Pressable>
      </View>

      {result ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          <Row label="Labor subtotal" value={`₹${result.laborSubtotal}`} />
          <Row label="Parts" value={`₹${result.partsCost}`} />
          <Row label="Subtotal" value={`₹${result.subtotal}`} bold />
          <Row label={`Tax (${result.taxPercent}%)`} value={`₹${result.tax}`} />
          <View style={styles.divider} />
          <Row label="Total to customer" value={`₹${result.total}`} highlight />
        </View>
      ) : null}

      <FooterCredit />
    </ScrollView>
  );
}

function Row({ label, value, bold, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold, highlight && styles.highlightLabel]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, highlight && styles.highlightValue]}>{value}</Text>
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
  cardTitle: { fontWeight: "700", color: colors.header, marginBottom: 12, fontSize: 15 },
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
    marginTop: 18,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  primaryTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  bold: { fontWeight: "700", color: colors.text },
  highlightLabel: { color: colors.header, fontSize: 16 },
  highlightValue: { color: colors.cta, fontSize: 18, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
});
