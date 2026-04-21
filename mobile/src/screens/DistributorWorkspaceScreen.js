import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { usersApi } from "../api/resources";
import { colors, shadows } from "../theme";

/** Distributor panel: company catalog, retailers, chat pointers. Cannot create distributors. */
export function DistributorWorkspaceScreen({ navigation }) {
  const [retail, setRetail] = useState([]);
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>Distributor workspace</Text>
      <Text style={styles.sub}>
        You buy stock from Hornvin company, sell to garages in your local network, and manage downstream listings. You cannot
        create other distributors — only Hornvin Super Admin can. Pending shop sign-ups are approved by Super Admin. Company
        catalog + stock orders for upstream; Marketplace + Chat for downstream; retailers list here.
      </Text>

      {summary ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Reports (limited)</Text>
          <Text style={styles.para}>
            Downstream snapshot only. Full platform analytics are Super Admin only (Profile → Super Admin).
          </Text>
          <Text style={styles.statLine}>Retailers linked: {summary.retailLinkedCount}</Text>
          <Text style={styles.statLine}>
            Retail awaiting Super Admin approval: {summary.pendingApprovalCount}
          </Text>
          <Text style={styles.statLine}>Open orders as seller: {summary.ordersOpenAsSeller}</Text>
          <Text style={[styles.statLine, { paddingBottom: 14 }]}>Open orders as buyer: {summary.ordersOpenAsBuyer}</Text>
        </View>
      ) : null}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Company & stock</Text>
        <Pressable onPress={() => navigation.navigate("CompanyCatalog")} style={styles.row}>
          <Text style={styles.rowTitle}>Company catalog</Text>
          <Text style={styles.rowSub}>View products from your linked company; buy stock as orders</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Main", { screen: "ExploreTab" })} style={styles.row}>
          <Text style={styles.rowTitle}>Full marketplace</Text>
          <Text style={styles.rowSub}>Explore all listings</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Chat</Text>
        <Text style={styles.para}>Use the Chat tab to message your company and retailers (open a room with their user).</Text>
      </View>

      <View style={[styles.card, shadows.card]}>
        <View style={styles.retailHeader}>
          <Text style={styles.cardTitle}>My retailers</Text>
          <Pressable onPress={() => setModal(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add retail</Text>
          </Pressable>
        </View>
        {retail.length === 0 ? (
          <Text style={styles.empty}>No retail shops yet.</Text>
        ) : (
          retail.map((u) => (
            <View key={String(u._id)} style={styles.retailRow}>
              <Text style={styles.rname}>{u.businessName || u.name || "Retail"}</Text>
              <Text style={styles.rmeta}>
                {u.status} · {u.email || u.phone || "—"}
              </Text>
            </View>
          ))
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.header },
  sub: { marginTop: 8, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: "800", color: colors.header, marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { fontWeight: "700", color: colors.text },
  rowSub: { marginTop: 2, fontSize: 13, color: colors.textSecondary },
  chev: { position: "absolute", right: 12, top: 14, fontSize: 20, color: colors.lightBlue },
  para: { paddingHorizontal: 12, paddingBottom: 12, color: colors.textSecondary, lineHeight: 20 },
  statLine: { paddingHorizontal: 12, paddingBottom: 8, color: colors.text, fontWeight: "600" },
  retailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 8 },
  addBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  addBtnText: { color: colors.cta, fontWeight: "800" },
  retailRow: { paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rname: { fontWeight: "700", color: colors.text },
  rmeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
