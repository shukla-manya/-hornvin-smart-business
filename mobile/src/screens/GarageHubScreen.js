import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

function Tile({ title, value, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, shadows.card]}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tileSub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

export function GarageHubScreen({ navigation }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await garageApi.summary();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading && !summary} onRefresh={load} tintColor={colors.header} />}
    >
      <Text style={styles.h1}>Garage operations</Text>
      <Text style={styles.sub}>
        Side 1 — run your shop: stock, jobs on the ramp, follow-ups, call scripts, and quick estimates. Marketplace stays in
        Explore.
      </Text>

      {loading && !summary ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.secondaryBlue} />
      ) : (
        <View style={styles.grid}>
          <Tile
            title="Inventory"
            value={summary?.inventoryCount ?? "—"}
            subtitle={summary?.lowStockCount ? `${summary.lowStockCount} at/below reorder` : "Parts & consumables"}
            onPress={() => navigation.getParent()?.navigate("GarageInventory")}
          />
          <Tile
            title="Service history"
            value={summary?.serviceHistoryCount ?? "—"}
            subtitle="Bay log & vehicles"
            onPress={() => navigation.getParent()?.navigate("GarageServiceHistory")}
          />
          <Tile
            title="Reminders"
            value={summary?.remindersDueSoon ?? "—"}
            subtitle="Next 14 days"
            onPress={() => navigation.getParent()?.navigate("GarageReminders")}
          />
          <Tile
            title="Customers"
            value={summary?.customerCount ?? "—"}
            subtitle="CRM-lite"
            onPress={() => navigation.getParent()?.navigate("GarageReminders")}
          />
        </View>
      )}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Tools</Text>
        <Pressable style={styles.row} onPress={() => navigation.getParent()?.navigate("GarageAiCalling")}>
          <Text style={styles.rowTitle}>AI call assistant</Text>
          <Text style={styles.rowSub}>Polished script + checklist (templates; add your LLM later)</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.getParent()?.navigate("GarageWorkEstimate")}>
          <Text style={styles.rowTitle}>Work estimation</Text>
          <Text style={styles.rowSub}>Labor + parts + tax → total</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.getParent()?.navigate("Invoices")}>
          <Text style={styles.rowTitle}>Invoices</Text>
          <Text style={styles.rowSub}>From B2B orders — same ledger as before</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  tile: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 108,
  },
  tileValue: { fontSize: 26, fontWeight: "700", color: colors.header },
  tileTitle: { marginTop: 4, fontSize: 14, fontWeight: "600", color: colors.text },
  tileSub: { marginTop: 4, fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  card: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardTitle: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, fontWeight: "700", color: colors.header, fontSize: 15 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    position: "relative",
  },
  rowTitle: { fontWeight: "600", color: colors.text, fontSize: 15 },
  rowSub: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 18, paddingRight: 8 },
  chev: { position: "absolute", right: 14, top: 22, fontSize: 20, color: colors.secondaryBlue },
});
