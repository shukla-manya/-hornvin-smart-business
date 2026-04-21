import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert, ScrollView, Share, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ordersApi, invoicesApi } from "../api/resources";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, orderStatusStyle } from "../theme";

function InvoiceStatus({ status }) {
  const map = {
    draft: { bg: "#F3F4F6", text: colors.textSecondary, border: colors.border },
    sent: { bg: "#DBEAFE", text: colors.header, border: colors.info },
    paid: { bg: "#DCFCE7", text: "#166534", border: colors.success },
    overdue: { bg: "#FEE2E2", text: "#991B1B", border: colors.error },
  };
  const s = map[status] || map.draft;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.pillText, { color: s.text }]}>{status}</Text>
    </View>
  );
}

function buildInvoiceShareMessage(inv) {
  const lines =
    inv.lines?.map((l) => `${l.description} × ${l.quantity} @ ₹${l.unitPrice} = ₹${l.amount}`).join("\n") || "(no line items)";
  const issuer = inv.issuerId?.businessName || inv.issuerId?.name || "Issuer";
  const customer = inv.customerId?.businessName || inv.customerId?.name || "Customer";
  return (
    `${inv.number}\n` +
    `${issuer} → ${customer}\n` +
    `Total: ₹${inv.total}\n\n` +
    `${lines}\n\n` +
    `— Shared from Vello. PDF export & WhatsApp file attach coming in a later release.`
  );
}

export function InvoicesScreen() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, ord] = await Promise.all([invoicesApi.list(), ordersApi.list()]);
      setInvoices(inv.data.invoices || []);
      setOrders(ord.data.orders || []);
    } catch {
      setInvoices([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const createInvoice = async (orderId) => {
    try {
      await invoicesApi.createFromOrder(orderId);
      await load();
      Alert.alert("Invoice", "Generated and saved. Customer can mark it paid; a payment record is created when they do.");
    } catch (e) {
      Alert.alert("Invoice", e.response?.data?.error || e.message);
    }
  };

  const shareInvoice = async (inv) => {
    try {
      await Share.share({
        title: inv.number,
        message: buildInvoiceShareMessage(inv),
      });
    } catch {
      /* user dismissed */
    }
  };

  const markPaid = (id) => {
    Alert.alert("Record payment", "Choose how this invoice was settled. A completed payment is saved for your ledger.", [
      { text: "UPI", onPress: () => submitPaid(id, "upi") },
      { text: "Cash", onPress: () => submitPaid(id, "cash") },
      { text: "Bank", onPress: () => submitPaid(id, "bank") },
      { text: "Card", onPress: () => submitPaid(id, "card") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submitPaid = async (id, method) => {
    try {
      await invoicesApi.updateStatus(id, { status: "paid", method });
      await load();
      Alert.alert("Saved", "Invoice marked paid and payment transaction recorded.");
    } catch (e) {
      Alert.alert("Invoice", e.response?.data?.error || e.message);
    }
  };

  const sellOrders = orders.filter((o) => (o.sellerId?._id || o.sellerId) === user?.id);
  const isEndCustomer = user?.role === "end_user";

  const header = isEndCustomer ? (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.section}>Your invoices</Text>
      <Text style={styles.muted}>
        When a garage or seller bills you for service or parts, it appears here. Use Service for order status, Chat if you need to
        reach the garage, and Mark paid when you have settled outside the app (cash, UPI, etc.).
      </Text>
      <Text style={[styles.section, { marginTop: 14 }]}>List</Text>
    </View>
  ) : (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.section}>Generate invoice (you are seller)</Text>
      {sellOrders.length === 0 ? (
        <Text style={styles.muted}>No sell-side orders yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
          {sellOrders.map((item) => {
            const st = orderStatusStyle(item.status);
            return (
              <View key={item._id} style={[styles.mini, shadows.card]}>
                <Text style={styles.miniTitle}>₹{item.total}</Text>
                <View style={[styles.orderPill, { backgroundColor: st.bg, borderColor: st.border }]}>
                  <Text style={[styles.orderPillText, { color: st.text }]}>{item.status}</Text>
                </View>
                <Pressable onPress={() => createInvoice(item._id)} style={styles.miniBtn}>
                  <Text style={styles.miniBtnText}>Generate</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
      <Text style={[styles.section, { marginTop: 12 }]}>Invoices</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={invoices}
        keyExtractor={(i) => i._id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.muted}>{loading ? "Loading…" : "No invoices yet."}</Text>}
        renderItem={({ item }) => {
          const isCustomer = (item.customerId?._id || item.customerId) === user?.id;
          return (
            <View style={[styles.card, shadows.card]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{item.number}</Text>
                <InvoiceStatus status={item.status} />
              </View>
              <Text style={styles.muted}>Total ₹{item.total}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => shareInvoice(item)} style={styles.btnShare}>
                  <Text style={styles.btnShareText}>Share</Text>
                </Pressable>
                {isCustomer && item.status !== "paid" ? (
                  <Pressable onPress={() => markPaid(item._id)} style={styles.btnPaid}>
                    <Text style={styles.btnPaidText}>Mark paid</Text>
                  </Pressable>
                ) : null}
              </View>
              {item.status === "paid" ? (
                <Text style={styles.hint}>Payment saved to your account history (Payments tab).</Text>
              ) : (
                <Text style={styles.hint}>
                  {Platform.OS === "ios" ? "Use Share for AirDrop/Messages; " : "Use Share for SMS/apps; "}
                  PDF & WhatsApp attachment later.
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 12 },
  section: { color: colors.header, fontWeight: "800", marginBottom: 8 },
  muted: { color: colors.textSecondary },
  mini: {
    width: 168,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  orderPill: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  orderPillText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  miniBtn: { marginTop: 10, backgroundColor: colors.secondaryBlue, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  miniBtnText: { color: colors.white, fontWeight: "800" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { color: colors.text, fontWeight: "800", flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  btnShare: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.secondaryBlue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnShareText: { color: colors.secondaryBlue, fontWeight: "800" },
  btnPaid: {
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnPaidText: { color: colors.white, fontWeight: "800" },
  hint: { marginTop: 10, color: colors.textSecondary, fontSize: 12 },
});
