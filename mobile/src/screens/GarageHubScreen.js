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

  const go = (route) => navigation.getParent()?.navigate(route);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading && !summary} onRefresh={load} tintColor={colors.header} />}
    >
      <Text style={styles.h1}>Internal tools</Text>
      <Text style={styles.sub}>
        Bay-side work: customers, vehicles, estimates, shop invoices, inventory with low-stock alerts, reminders, and call scripts. The
        blue half of your day (buy / sell / suppliers) lives under Marketplace.
      </Text>

      {loading && !summary ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.secondaryBlue} />
      ) : (
        <View style={styles.grid}>
          <Tile
            title="Customers"
            value={summary?.customerCount ?? "—"}
            subtitle="Phone, reminders, auto messages"
            onPress={() => go("GarageReminders")}
          />
          <Tile
            title="Vehicles"
            value={summary?.vehicleCount ?? "—"}
            subtitle="Plates, models, link to jobs"
            onPress={() => go("GarageVehicles")}
          />
          <Tile
            title="Work estimate"
            value={summary?.estimateOpenCount ?? "—"}
            subtitle="Lines + WhatsApp"
            onPress={() => go("GarageWorkEstimate")}
          />
          <Tile
            title="Shop invoices"
            value={summary?.shopInvoiceOpenCount ?? "—"}
            subtitle="Payment + share"
            onPress={() => go("GarageShopInvoices")}
          />
          <Tile
            title="Inventory"
            value={summary?.inventoryCount ?? "—"}
            subtitle={summary?.lowStockCount ? `${summary.lowStockCount} low stock` : "Stock & reorder"}
            onPress={() => go("GarageInventory")}
          />
          <Tile
            title="Service history"
            value={summary?.serviceHistoryCount ?? "—"}
            subtitle="Bay log"
            onPress={() => go("GarageServiceHistory")}
          />
          <Tile title="Due soon" value={summary?.remindersDueSoon ?? "—"} subtitle="Next 14 days" onPress={() => go("GarageReminders")} />
          <Tile title="AI calling" value="AI" subtitle="Batch scripts" onPress={() => go("GarageAiCalling")} />
        </View>
      )}

      <View style={[styles.card, shadows.card, styles.externalCard]}>
        <Text style={styles.cardTitle}>External marketplace</Text>
        <Text style={styles.externalHint}>Buy parts, sell listings, chat, find suppliers — switch to the Marketplace tab.</Text>
        <Pressable style={styles.externalBtn} onPress={() => navigation.navigate("ExploreTab")}>
          <Text style={styles.externalBtnTxt}>Open Marketplace tab</Text>
        </Pressable>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Ledger & admin</Text>
        <Pressable style={styles.row} onPress={() => go("Invoices")}>
          <Text style={styles.rowTitle}>B2B invoices</Text>
          <Text style={styles.rowSub}>From Hornvin orders — same ledger as before</Text>
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
  externalCard: { marginBottom: 12, borderColor: colors.secondaryBlue, backgroundColor: "#F0F5FA" },
  externalHint: { paddingHorizontal: 14, paddingBottom: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  externalBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    alignSelf: "flex-start",
    backgroundColor: colors.secondaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  externalBtnTxt: { color: colors.white, fontWeight: "800", fontSize: 14 },
});
