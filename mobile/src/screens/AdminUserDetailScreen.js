import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

export function AdminUserDetailScreen({ route, navigation }) {
  const userId = route.params?.userId;
  const [payload, setPayload] = useState(null);
  const [regionDraft, setRegionDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await adminApi.userDetail(userId);
    setPayload(data);
    setRegionDraft(data.user?.distributorRegion || "");
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert("Error", e.response?.data?.error || e.message));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const patchStatus = (status) => {
    Alert.alert("Change status", `Set to ${status}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusy(true);
          try {
            await adminApi.patchUser(userId, { status });
            await load();
          } catch (e) {
            Alert.alert("Error", e.response?.data?.error || e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const saveRegion = async () => {
    if (payload?.user?.role !== "distributor") return;
    setBusy(true);
    try {
      await adminApi.patchUser(userId, { distributorRegion: regionDraft.trim() });
      await load();
      Alert.alert("Saved", "Distributor region updated.");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No user selected.</Text>
      </View>
    );
  }

  const u = payload?.user;
  const st = payload?.stats;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!u ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.secondaryBlue} />
      ) : (
        <>
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.name}>{u.name || u.businessName || "—"}</Text>
            <Text style={styles.meta}>
              {u.role} · {u.status || "approved"} · {u.email || u.phone || "—"}
            </Text>
            {u.businessName ? <Text style={styles.line}>Business: {u.businessName}</Text> : null}
            {u.distributorRegion ? <Text style={styles.line}>Region: {u.distributorRegion}</Text> : null}
            <Text style={styles.line}>
              Permissions — sell {u.permissions?.canSell !== false ? "on" : "off"} · products{" "}
              {u.permissions?.canAddProducts !== false ? "on" : "off"} · orders {u.permissions?.canPlaceOrders !== false ? "on" : "off"}
            </Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Text style={styles.statLine}>Orders as buyer: {st?.ordersAsBuyer ?? 0}</Text>
            <Text style={styles.statLine}>Orders as seller: {st?.ordersAsSeller ?? 0}</Text>
            {u.role === "distributor" ? <Text style={styles.statLine}>Linked garages: {st?.linkedGarages ?? 0}</Text> : null}
          </View>

          {u.role === "distributor" ? (
            <View style={[styles.card, shadows.card]}>
              <Text style={styles.sectionTitle}>Assign region</Text>
              <Text style={styles.hint}>Territory label for reporting (e.g. North Zone, Mumbai cluster).</Text>
              <TextInput
                style={styles.input}
                value={regionDraft}
                onChangeText={setRegionDraft}
                placeholder="Region / territory"
                placeholderTextColor={colors.textSecondary}
              />
              <Pressable onPress={saveRegion} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                <Text style={styles.btnTxt}>Save region</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Moderation</Text>
            <View style={styles.rowWrap}>
              <Pressable onPress={() => patchStatus("approved")} style={styles.chip} disabled={busy}>
                <Text style={styles.chipTxt}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => patchStatus("pending")} style={styles.chip} disabled={busy}>
                <Text style={styles.chipTxt}>Pending</Text>
              </Pressable>
              <Pressable onPress={() => patchStatus("suspended")} style={styles.chipWarn} disabled={busy}>
                <Text style={styles.chipTxt}>Suspend</Text>
              </Pressable>
              <Pressable onPress={() => patchStatus("blocked")} style={styles.chipWarn} disabled={busy}>
                <Text style={styles.chipTxt}>Block</Text>
              </Pressable>
              <Pressable onPress={() => patchStatus("rejected")} style={styles.chipWarn} disabled={busy}>
                <Text style={styles.chipTxt}>Reject</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent orders (this user)</Text>
          {(payload?.recentActivity || []).map((o) => (
            <Pressable
              key={String(o._id)}
              onPress={() => navigation.navigate("AdminOrderDetail", { orderId: o._id })}
              style={[styles.miniCard, shadows.card]}
            >
              <Text style={styles.miniAmt}>₹{Number(o.total).toFixed(2)} · {o.status}</Text>
              <Text style={styles.miniSub}>{o.orderChannel === "stock" ? "Stock" : "Marketplace"}</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 20, fontWeight: "800", color: colors.header },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 14 },
  line: { marginTop: 8, color: colors.text, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.header, marginBottom: 8 },
  statLine: { color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.card,
    color: colors.text,
  },
  btn: { backgroundColor: colors.cta, padding: 12, borderRadius: 12, alignItems: "center" },
  btnTxt: { color: colors.white, fontWeight: "800" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.selectionBg, borderWidth: 1, borderColor: colors.selectionBorder },
  chipWarn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  chipTxt: { fontWeight: "700", color: colors.header, fontSize: 13 },
  miniCard: { padding: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  miniAmt: { fontWeight: "800", color: colors.text },
  miniSub: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
});
