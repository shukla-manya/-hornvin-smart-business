import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi } from "../api/resources";
import { colors, shadows } from "../theme";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "suspended", label: "Suspended" },
  { id: "blocked", label: "Blocked" },
];

const ROLE_FILTERS = [
  { id: "", label: "All roles" },
  { id: "distributor", label: "Distributors" },
  { id: "retail", label: "Garages" },
  { id: "company", label: "Company" },
  { id: "end_user", label: "End users" },
];

export function AdminUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [roleFilter, setRoleFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [dEmail, setDEmail] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dName, setDName] = useState("");
  const [dPw, setDPw] = useState("");

  const load = useCallback(async () => {
    const params = { limit: 100 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (roleFilter) params.role = roleFilter;
    const { data } = await adminApi.users(params);
    setUsers(data.users || []);
  }, [statusFilter, roleFilter]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert("Error", e.response?.data?.error || e.message));
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

  const patchStatus = async (id, status) => {
    setBusy(true);
    try {
      await adminApi.patchUser(id, { status });
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const patchPerms = async (id, partial) => {
    setBusy(true);
    try {
      await adminApi.patchUser(id, { permissions: partial });
      await load();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const createDistributor = async () => {
    if (dPw.length < 6) return Alert.alert("Password", "Min 6 characters");
    if (!dEmail.trim() && !dPhone.trim()) return Alert.alert("Contact", "Email or phone required");
    setBusy(true);
    try {
      await adminApi.createDistributor({
        email: dEmail.trim() || undefined,
        phone: dPhone.trim() || undefined,
        password: dPw,
        name: dName.trim() || undefined,
      });
      setModal(false);
      setDEmail("");
      setDPhone("");
      setDName("");
      setDPw("");
      await load();
      Alert.alert(
        "Distributor created",
        "If you entered an email, we sent login steps and the temporary password there. They must set a new password on first sign-in before using the app."
      );
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const moderate = (u) => {
    Alert.alert(
      u.name || u.email || u.phone || "User",
      `Role: ${u.role} · Status: ${u.status}\n\nSuspend = temporary hold (restore with Approve). Block = stronger restriction.`,
      [
        { text: "Approve", onPress: () => patchStatus(u._id || u.id, "approved") },
        { text: "Pending", onPress: () => patchStatus(u._id || u.id, "pending") },
        { text: "Suspend", onPress: () => patchStatus(u._id || u.id, "suspended"), style: "destructive" },
        { text: "Block", onPress: () => patchStatus(u._id || u.id, "blocked"), style: "destructive" },
        { text: "Reject", onPress: () => patchStatus(u._id || u.id, "rejected"), style: "destructive" },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const perms = (u) => {
    const id = u._id || u.id;
    const curSell = u.permissions?.canSell !== false;
    const curAdd = u.permissions?.canAddProducts !== false;
    const curBuy = u.permissions?.canPlaceOrders !== false;
    Alert.alert("Permissions", "Tap to flip each capability", [
      {
        text: `${curSell ? "✓" : "✗"} Sell / receive orders → ${curSell ? "OFF" : "ON"}`,
        onPress: () => patchPerms(id, { canSell: !curSell }),
      },
      {
        text: `${curAdd ? "✓" : "✗"} Add products → ${curAdd ? "OFF" : "ON"}`,
        onPress: () => patchPerms(id, { canAddProducts: !curAdd }),
      },
      {
        text: `${curBuy ? "✓" : "✗"} Place orders → ${curBuy ? "OFF" : "ON"}`,
        onPress: () => patchPerms(id, { canPlaceOrders: !curBuy }),
      },
      { text: "Close", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Approve pending signups so they receive a session. Create distributors here — they cannot self-register in production.
      </Text>
      <Text style={styles.filterLabel}>Status</Text>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setStatusFilter(f.id)}
            style={[styles.filterChip, statusFilter === f.id && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipTxt, statusFilter === f.id && styles.filterChipTxtOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.filterLabel}>Role</Text>
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
          <Pressable
            key={f.id || "allroles"}
            onPress={() => setRoleFilter(f.id)}
            style={[styles.filterChip, roleFilter === f.id && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipTxt, roleFilter === f.id && styles.filterChipTxtOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setModal(true)} style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy}>
        <Text style={styles.ctaText}>+ Create distributor</Text>
      </Pressable>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item._id || item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!busy ? <Text style={styles.empty}>No users</Text> : <ActivityIndicator style={{ marginTop: 24 }} />}
        renderItem={({ item: u }) => (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.name}>{u.name || "—"}</Text>
            <Text style={styles.meta}>
              {u.role} · {u.status} · {u.email || u.phone || "—"}
            </Text>
            {u.createdBy && (u.createdBy.name || u.createdBy.email || u.createdBy.phone) ? (
              <Text style={styles.createdBy}>
                Created by: {u.createdBy.businessName || u.createdBy.name || u.createdBy.email || u.createdBy.phone || "—"}
              </Text>
            ) : null}
            <Text style={styles.perm}>
              Sell {u.permissions?.canSell !== false ? "on" : "off"} · Products {u.permissions?.canAddProducts !== false ? "on" : "off"} · Orders{" "}
              {u.permissions?.canPlaceOrders !== false ? "on" : "off"}
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => navigation.navigate("AdminUserDetail", { userId: u._id || u.id })}
                style={[styles.btn, styles.btnPrimary]}
              >
                <Text style={styles.btnTxtPrimary}>Details</Text>
              </Pressable>
              <Pressable onPress={() => moderate(u)} style={styles.btn}>
                <Text style={styles.btnTxt}>Status</Text>
              </Pressable>
              <Pressable onPress={() => perms(u)} style={styles.btn}>
                <Text style={styles.btnTxt}>Permissions</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New distributor</Text>
            <Text style={styles.modalHint}>Use email so Vello can send credentials (SMTP must be configured on the server).</Text>
            <TextInput style={styles.input} placeholder="Email" value={dEmail} onChangeText={setDEmail} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Phone (optional)" value={dPhone} onChangeText={setDPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Name" value={dName} onChangeText={setDName} />
            <TextInput style={styles.input} placeholder="Password (min 6)" value={dPw} onChangeText={setDPw} secureTextEntry />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setModal(false)} style={styles.secondary}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable onPress={createDistributor} style={styles.cta}>
                <Text style={styles.ctaText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 8 },
  intro: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  filterLabel: { marginHorizontal: 16, marginBottom: 6, fontSize: 12, fontWeight: "800", color: colors.header },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterChipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  filterChipTxt: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  filterChipTxtOn: { color: colors.header },
  cta: { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.cta, padding: 14, borderRadius: 12, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800" },
  card: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  createdBy: { marginTop: 4, fontSize: 12, color: colors.header, fontWeight: "600" },
  perm: { marginTop: 6, fontSize: 12, color: colors.header },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { flexGrow: 1, flexBasis: "30%", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.secondaryBlue, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.secondaryBlue, borderColor: colors.secondaryBlue },
  btnTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  btnTxtPrimary: { color: colors.white, fontWeight: "800" },
  empty: { textAlign: "center", marginTop: 40, color: colors.textSecondary },
  modalBg: { flex: 1, backgroundColor: "#0008", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  secondary: { padding: 12 },
});
