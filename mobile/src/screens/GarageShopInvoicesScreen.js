import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Share, Linking, Alert, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

export function GarageShopInvoicesScreen() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await garageApi.shopInvoicesList();
      setInvoices(data.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const sharePdf = async (id) => {
    try {
      const { data } = await garageApi.shopInvoiceShare(id);
      await Share.share({ title: data.title, message: data.text });
    } catch (e) {
      Alert.alert("Share", e.response?.data?.error || e.message);
    }
  };

  const whatsappShare = async (id) => {
    try {
      const { data } = await garageApi.shopInvoiceShare(id);
      const url = `whatsapp://send?text=${encodeURIComponent(data.text)}`;
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else await Share.share({ message: data.text });
    } catch (e) {
      Alert.alert("WhatsApp", e.response?.data?.error || e.message);
    }
  };

  const setStatus = async (status) => {
    if (!payModal) return;
    try {
      await garageApi.shopInvoicePatchPayment(payModal._id, { paymentStatus: status });
      setPayModal(null);
      await load();
    } catch (e) {
      Alert.alert("Update", e.response?.data?.error || e.message);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Shop invoices</Text>
      <Text style={styles.sub}>From saved estimates — payment status, share as text / WhatsApp (PDF via print later).</Text>
      <FlatList
        data={invoices}
        keyExtractor={(x) => x._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "…" : "No shop invoices yet — convert an estimate."}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.num}>{item.number}</Text>
            <Text style={styles.meta}>Total ₹{item.total} · {item.paymentStatus}</Text>
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={() => setPayModal(item)}>
                <Text style={styles.btnTxt}>Payment</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => sharePdf(item._id)}>
                <Text style={styles.btnTxt}>Share</Text>
              </Pressable>
              <Pressable style={styles.btnWa} onPress={() => whatsappShare(item._id)}>
                <Text style={styles.btnWaTxt}>WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListFooterComponent={<FooterCredit />}
      />
      <Modal visible={!!payModal} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Payment status</Text>
            <Pressable style={styles.opt} onPress={() => setStatus("pending")}>
              <Text style={styles.optTxt}>Pending</Text>
            </Pressable>
            <Pressable style={styles.opt} onPress={() => setStatus("partial")}>
              <Text style={styles.optTxt}>Partial</Text>
            </Pressable>
            <Pressable style={styles.opt} onPress={() => setStatus("paid")}>
              <Text style={styles.optTxt}>Paid</Text>
            </Pressable>
            <Pressable onPress={() => setPayModal(null)} style={styles.cancel}>
              <Text style={styles.cancelTxt}>Close</Text>
            </Pressable>
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
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 32 },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  num: { fontSize: 16, fontWeight: "800", color: colors.header },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.selectionBg, borderRadius: 10, borderWidth: 1, borderColor: colors.selectionBorder },
  btnTxt: { fontWeight: "700", color: colors.header, fontSize: 13 },
  btnWa: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#DCFCE7", borderRadius: 10, borderWidth: 1, borderColor: "#86EFAC" },
  btnWaTxt: { fontWeight: "800", color: "#166534", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  sheetTitle: { fontWeight: "800", color: colors.header, marginBottom: 12, fontSize: 16 },
  opt: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optTxt: { fontSize: 16, color: colors.text, fontWeight: "600" },
  cancel: { marginTop: 12, alignItems: "center", padding: 12 },
  cancelTxt: { color: colors.secondaryBlue, fontWeight: "700" },
});
