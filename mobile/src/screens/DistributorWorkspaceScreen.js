import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Alert, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { usersApi, chatApi } from "../api/resources";
import { colors, shadows } from "../theme";

/** Distributor panel: dashboard, stock, garage orders, inventory, billing, map, chat. */
export function DistributorWorkspaceScreen({ navigation }) {
  const [retail, setRetail] = useState([]);
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openingChat, setOpeningChat] = useState(null);
  const [modal, setModal] = useState(false);
  const [rEmail, setREmail] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rName, setRName] = useState("");
  const [rBiz, setRBiz] = useState("");
  const [rPw, setRPw] = useState("");

  const load = useCallback(async () => {
    const [retailRes, sumRes] = await Promise.all([
      usersApi.myRetail(),
      usersApi.workspaceSummary().catch(() => ({ data: null })),
    ]);
    setRetail(retailRes.data.retail || []);
    setSummary(sumRes.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const createRetail = async () => {
    if (rPw.length < 6) return Alert.alert("Password", "Min 6 characters");
    if (!rEmail.trim() && !rPhone.trim()) return Alert.alert("Contact", "Email or phone required");
    try {
      await usersApi.createRetail({
        email: rEmail.trim() || undefined,
        phone: rPhone.trim() || undefined,
        password: rPw,
        name: rName.trim() || undefined,
        businessName: rBiz.trim() || undefined,
      });
      setModal(false);
      setREmail("");
      setRPhone("");
      setRName("");
      setRBiz("");
      setRPw("");
      await load();
      Alert.alert(
        "Retail account created",
        "Share the phone/email and password with the shop. They will be asked to set a new password on first login."
      );
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const openChatWith = async (userId) => {
    setOpeningChat(userId);
    try {
      const { data } = await chatApi.openRoom(userId);
      navigation.navigate("ChatRoom", { room: data.room });
    } catch (e) {
      Alert.alert("Chat", e.response?.data?.error || e.message);
    } finally {
      setOpeningChat(null);
    }
  };

  const goTab = (tab) => navigation.navigate("Main", { screen: tab });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>Distributor panel</Text>
      <Text style={styles.sub}>
        You were created by Hornvin Super Admin. Buy stock from the linked company, sell to approved garages, and run your
        branch on the marketplace. Use Orders to accept or reject garage requests and move fulfilment status; Invoices and
        Payments for billing.
      </Text>

      {summary ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Dashboard</Text>
          <Text style={styles.statLine}>Open orders to you (garages & buyers): {summary.ordersOpenAsSeller}</Text>
          <Text style={styles.statLine}>Open stock purchases from company: {summary.stockOrdersOpenAsBuyer ?? 0}</Text>
          <Text style={styles.statLine}>Completed sales revenue (you as seller): ₹{Number(summary.completedRevenueAsSeller ?? 0).toFixed(2)}</Text>
          <Text style={styles.statLine}>Low-stock SKUs (≤5 units): {summary.lowStockSkuCount ?? 0}</Text>
          <Text style={styles.statLine}>New garage orders awaiting accept: {summary.garageOrdersPendingAsSeller ?? 0}</Text>
          <Text style={[styles.statLine, { paddingBottom: 12 }]}>
            Linked garages: {summary.retailLinkedCount} · Pending Super Admin approval: {summary.pendingApprovalCount}
          </Text>
        </View>
      ) : (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.muted}>Could not load workspace summary. Link to a company if prompted.</Text>
        </View>
      )}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Stock & products</Text>
        <RowNav title="Company catalog" sub="Browse Hornvin SKUs, place stock orders, track in Orders" onPress={() => navigation.navigate("CompanyCatalog")} />
        <RowNav title="My inventory" sub="Adjust quantities, low-stock highlights" onPress={() => navigation.navigate("DistributorInventory")} />
        <RowNav title="Add custom product" sub="Optional marketplace listing" onPress={() => navigation.navigate("PostProduct")} />
        <RowNav title="Full marketplace" sub="Explore all listings" onPress={() => goTab("ExploreTab")} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Orders & billing</Text>
        <RowNav title="Orders" sub="Accept / reject, processing, delivery — stock + marketplace" onPress={() => goTab("OrdersTab")} />
        <RowNav title="Invoices" sub="Generate for garages from fulfilled orders" onPress={() => navigation.navigate("Invoices")} />
        <RowNav title="Payments" sub="Track UPI and cash from shops" onPress={() => navigation.navigate("Payments")} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Chat & map</Text>
        <RowNav title="Chat tab" sub="Threads with Hornvin company and garages" onPress={() => goTab("ChatTab")} />
        <RowNav title="Nearby garages" sub="Dealer locator (retail)" onPress={() => navigation.navigate("DealerMap", { initialRole: "retail" })} />
        <RowNav title="Notifications" sub="Orders, messages, system" onPress={() => navigation.navigate("Notifications")} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <View style={styles.retailHeader}>
          <Text style={styles.cardTitle}>My garages</Text>
          <Pressable onPress={() => setModal(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add retail</Text>
          </Pressable>
        </View>
        {retail.length === 0 ? (
          <Text style={styles.empty}>No retail shops yet.</Text>
        ) : (
          retail.map((u) => {
            const id = u._id || u.id;
            const busy = openingChat === id;
            return (
              <View key={String(id)} style={styles.retailRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rname}>{u.businessName || u.name || "Retail"}</Text>
                  <Text style={styles.rmeta}>
                    {u.status} · {u.email || u.phone || "—"}
                  </Text>
                </View>
                <Pressable onPress={() => openChatWith(id)} disabled={busy} style={styles.chatBtn}>
                  <Text style={styles.chatBtnTxt}>{busy ? "…" : "Message"}</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New retail / garage</Text>
            <TextInput style={styles.input} placeholder="Email" value={rEmail} onChangeText={setREmail} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Phone" value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Shop name" value={rBiz} onChangeText={setRBiz} />
            <TextInput style={styles.input} placeholder="Contact name" value={rName} onChangeText={setRName} />
            <TextInput style={styles.input} placeholder="Password (min 6)" value={rPw} onChangeText={setRPw} secureTextEntry />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createRetail} style={styles.cta}>
                <Text style={styles.ctaText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function RowNav({ title, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.header },
  sub: { marginTop: 8, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  muted: { padding: 12, color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: "800", color: colors.header, marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, position: "relative", paddingRight: 28 },
  rowTitle: { fontWeight: "700", color: colors.text },
  rowSub: { marginTop: 2, fontSize: 13, color: colors.textSecondary },
  chev: { position: "absolute", right: 12, top: 14, fontSize: 20, color: colors.lightBlue },
  statLine: { paddingHorizontal: 12, paddingBottom: 6, color: colors.text, fontWeight: "600" },
  retailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 8 },
  addBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  addBtnText: { color: colors.cta, fontWeight: "800" },
  retailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  rname: { fontWeight: "700", color: colors.text },
  rmeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chatBtn: { backgroundColor: colors.secondaryBlue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  chatBtnTxt: { color: colors.white, fontWeight: "800", fontSize: 12 },
  empty: { padding: 16, color: colors.textSecondary },
  modalBg: { flex: 1, backgroundColor: "#0008", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 8, alignItems: "center" },
  cancel: { color: colors.textSecondary },
  cta: { backgroundColor: colors.cta, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  ctaText: { color: colors.white, fontWeight: "800" },
});
