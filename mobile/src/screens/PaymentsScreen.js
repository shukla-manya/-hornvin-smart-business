import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, TextInput, Alert, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

const METHODS = ["cash", "upi", "bank", "card", "unknown"];

export function PaymentsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payments");
      setItems(data.payments || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const markCompleted = async (id) => {
    try {
      await api.patch(`/payments/${id}/status`, { status: "completed" });
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    }
  };

  const submit = async () => {
    if (!payeeId.trim()) return Alert.alert("Payee", "Enter payee user id.");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return Alert.alert("Amount", "Enter a valid amount.");
    setBusy(true);
    try {
      await api.post("/payments", {
        payeeId: payeeId.trim(),
        amount: amt,
        method,
        orderId: orderId.trim() || undefined,
      });
      setPayeeId("");
      setAmount("");
      setOrderId("");
      setShowForm(false);
      await load();
      Alert.alert("Saved", "Payment record created.");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={{ marginBottom: 12 }}>
      <Pressable onPress={() => setShowForm((s) => !s)} style={styles.toggleBtn}>
        <Text style={styles.toggleBtnText}>{showForm ? "Hide form" : "Record payment"}</Text>
      </Pressable>
      {showForm ? (
        <View style={[styles.form, shadows.card]}>
          <Text style={styles.hint}>Payee MongoDB user id (from profile or order party)</Text>
          <TextInput value={payeeId} onChangeText={setPayeeId} placeholder="Payee user id" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" />
          <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <TextInput value={orderId} onChangeText={setOrderId} placeholder="Order id (optional)" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" />
          <Text style={styles.label}>Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {METHODS.map((m) => (
              <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipOn]}>
                <Text style={[styles.chipText, method === m && styles.chipTextOn]}>{m}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
            <Text style={styles.ctaText}>Create</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(p) => p._id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : "No payments yet."}</Text>}
        renderItem={({ item }) => {
          const pid = item.payerId?._id || item.payerId;
          const minePay = pid === user?.id;
          const peer = minePay ? item.payeeId : item.payerId;
          const peerName = peer?.businessName || peer?.name || "Party";
          const payeeId = item.payeeId?._id || item.payeeId;
          const canComplete = item.status === "pending" && payeeId === user?.id;
          return (
            <View style={[styles.card, shadows.card]}>
              <Text style={styles.amt}>
                ₹{item.amount} · {item.status}
              </Text>
              <Text style={styles.meta}>Method: {item.method}</Text>
              <Text style={styles.meta}>{minePay ? `You paid → ${peerName}` : `${peerName} paid → you`}</Text>
              {canComplete ? (
                <Pressable onPress={() => markCompleted(item._id)} style={styles.recv}>
                  <Text style={styles.recvText}>Mark received (completed)</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={<FooterCredit />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toggleBtn: { alignSelf: "flex-start", backgroundColor: colors.secondaryBlue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginBottom: 10 },
  toggleBtnText: { color: colors.white, fontWeight: "800" },
  form: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    color: colors.text,
    backgroundColor: colors.white,
  },
  label: { color: colors.textSecondary, marginBottom: 6, fontWeight: "600" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  chipText: { color: colors.textSecondary, textTransform: "capitalize" },
  chipTextOn: { color: colors.secondaryBlue, fontWeight: "800" },
  cta: { backgroundColor: colors.cta, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800" },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  amt: { fontWeight: "800", color: colors.text, fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
  recv: { marginTop: 10, alignSelf: "flex-start", backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  recvText: { color: colors.white, fontWeight: "800", fontSize: 12 },
});
