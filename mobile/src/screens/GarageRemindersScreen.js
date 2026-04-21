import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

function reminderLabel(c) {
  if (!c.nextReminderAt) return "No date set";
  const d = new Date(c.nextReminderAt);
  const now = new Date();
  const days = Math.ceil((d - now) / (24 * 60 * 60 * 1000));
  if (Number.isNaN(days)) return "—";
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function GarageRemindersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [reminderLabelText, setReminderLabelText] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [autoTemplate, setAutoTemplate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await garageApi.customersList();
      const list = [...(data.customers || [])].sort((a, b) => {
        const ta = a.nextReminderAt ? new Date(a.nextReminderAt).getTime() : Infinity;
        const tb = b.nextReminderAt ? new Date(b.nextReminderAt).getTime() : Infinity;
        return ta - tb;
      });
      setCustomers(list);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const openNew = () => {
    setEditId(null);
    setName("");
    setPhone("");
    setVehiclePlate("");
    setVehicleModel("");
    setReminderLabelText("");
    setNextDate("");
    setPaymentDate("");
    setPaymentLabel("");
    setAutoTemplate("");
    setNotes("");
    setModal(true);
  };

  const openEdit = (c) => {
    setEditId(c._id);
    setName(c.name || "");
    setPhone(c.phone || "");
    setVehiclePlate(c.vehiclePlate || "");
    setVehicleModel(c.vehicleModel || "");
    setReminderLabelText(c.reminderLabel || "");
    setNextDate(c.nextReminderAt ? new Date(c.nextReminderAt).toISOString().slice(0, 10) : "");
    setPaymentDate(c.paymentReminderAt ? new Date(c.paymentReminderAt).toISOString().slice(0, 10) : "");
    setPaymentLabel(c.paymentReminderLabel || "");
    setAutoTemplate(c.automatedMessageTemplate || "");
    setNotes(c.notes || "");
    setModal(true);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name", "Customer or fleet name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        notes: notes.trim(),
        reminderLabel: reminderLabelText.trim(),
        nextReminderAt: nextDate.trim() ? `${nextDate.trim()}T09:00:00.000Z` : undefined,
        paymentReminderAt: paymentDate.trim() ? `${paymentDate.trim()}T09:00:00.000Z` : undefined,
        paymentReminderLabel: paymentLabel.trim(),
        automatedMessageTemplate: autoTemplate.trim(),
      };
      if (editId) await garageApi.customerPatch(editId, payload);
      else await garageApi.customerCreate(payload);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert("Save", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (c) => {
    Alert.alert("Remove customer", `Remove ${c.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await garageApi.customerDelete(c._id);
            await load();
          } catch (e) {
            Alert.alert("Remove", e.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  const previewAutoMessage = async (customerId) => {
    try {
      const { data } = await garageApi.customerAutomatedMessage(customerId);
      const msg = data.message || "";
      await Share.share({ message: msg });
    } catch (e) {
      Alert.alert("Preview", e.response?.data?.error || e.message);
    }
  };

  const whatsappAutoMessage = async (customerId) => {
    try {
      const { data } = await garageApi.customerAutomatedMessage(customerId);
      const msg = data.message || "";
      const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else await Share.share({ message: msg });
    } catch (e) {
      Alert.alert("WhatsApp", e.response?.data?.error || e.message);
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={customers}
        keyExtractor={(c) => c._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.header} />}
        ListHeaderComponent={
          <Text style={styles.lead}>
            Customer management: save phone, link vehicles from the row action, set service and payment reminders, and draft automated
            WhatsApp messages (tokens: {"{{name}}"}, {"{{plate}}"}, {"{{paymentDue}}"}).
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.secondaryBlue} />
          ) : (
            <Text style={styles.empty}>No customers yet — add your regulars and fleet managers.</Text>
          )
        }
        ListFooterComponent={<View style={{ height: 100 }}><FooterCredit /></View>}
        renderItem={({ item }) => {
          const urgent = item.nextReminderAt && new Date(item.nextReminderAt) < new Date();
          const payUrgent = item.paymentReminderAt && new Date(item.paymentReminderAt) < new Date();
          return (
            <View style={[styles.card, shadows.card, urgent && styles.cardUrgent]}>
              <Pressable onPress={() => openEdit(item)}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{[item.phone, item.vehiclePlate, item.vehicleModel].filter(Boolean).join(" · ") || "—"}</Text>
                {item.reminderLabel ? <Text style={styles.reminder}>{item.reminderLabel}</Text> : null}
                <Text style={[styles.due, urgent && styles.dueUrgent]}>Service: {reminderLabel(item)}</Text>
                {item.paymentReminderAt ? (
                  <Text style={[styles.due, payUrgent && styles.dueUrgent]}>
                    Payment: {reminderLabel({ nextReminderAt: item.paymentReminderAt })}
                    {item.paymentReminderLabel ? ` — ${item.paymentReminderLabel}` : ""}
                  </Text>
                ) : null}
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable onPress={() => navigation.navigate("GarageVehicles", { customerId: item._id, customerName: item.name })} style={styles.linkAct}>
                  <Text style={styles.linkActTxt}>Vehicles</Text>
                </Pressable>
                <Pressable onPress={() => previewAutoMessage(item._id)} style={styles.linkAct}>
                  <Text style={styles.linkActTxt}>Auto msg</Text>
                </Pressable>
                <Pressable onPress={() => whatsappAutoMessage(item._id)} style={styles.linkAct}>
                  <Text style={styles.linkActTxt}>WA</Text>
                </Pressable>
                <Pressable onPress={() => openEdit(item)} style={styles.linkAct}>
                  <Text style={styles.linkActTxt}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} style={styles.delHit}>
                  <Text style={styles.delTxt}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      />
      <Pressable style={styles.fab} onPress={openNew}>
        <Text style={styles.fabTxt}>+ Add customer</Text>
      </Pressable>
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editId ? "Edit customer" : "New customer"}</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Primary vehicle plate (CRM snapshot)</Text>
            <TextInput value={vehiclePlate} onChangeText={setVehiclePlate} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Primary vehicle model</Text>
            <TextInput value={vehicleModel} onChangeText={setVehicleModel} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Service reminder label</Text>
            <TextInput
              value={reminderLabelText}
              onChangeText={setReminderLabelText}
              placeholder="e.g. Annual service / insurance renewal"
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>Next service reminder (YYYY-MM-DD)</Text>
            <TextInput value={nextDate} onChangeText={setNextDate} placeholder="2026-05-01" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Payment reminder (YYYY-MM-DD)</Text>
            <TextInput value={paymentDate} onChangeText={setPaymentDate} placeholder="2026-05-15" style={styles.input} placeholderTextColor={colors.textSecondary} />
            <Text style={styles.label}>Payment reminder label</Text>
            <TextInput
              value={paymentLabel}
              onChangeText={setPaymentLabel}
              placeholder="e.g. Balance on invoice #12"
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>Automated message template</Text>
            <TextInput
              value={autoTemplate}
              onChangeText={setAutoTemplate}
              placeholder={'Hi {{name}}, about {{plate}}. {{paymentDue}}'}
              style={[styles.input, { minHeight: 72 }]}
              multiline
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)} style={styles.btnGhost}>
                <Text style={styles.btnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save} style={styles.btnPrimary} disabled={saving}>
                <Text style={styles.btnPrimaryTxt}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  lead: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUrgent: { borderColor: colors.error, backgroundColor: "#FFF5F5" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13 },
  reminder: { marginTop: 8, color: colors.header, fontWeight: "600", fontSize: 14 },
  due: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  dueUrgent: { color: colors.error, fontWeight: "700" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 12, gap: 10 },
  linkAct: { paddingVertical: 6, paddingHorizontal: 4 },
  linkActTxt: { color: colors.secondaryBlue, fontWeight: "700", fontSize: 13 },
  delHit: { marginLeft: "auto" },
  delTxt: { color: colors.error, fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 16,
    left: 16,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  fabTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalScroll: { maxHeight: "92%" },
  modalCard: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.header, marginBottom: 8 },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  btnGhostTxt: { color: colors.secondaryBlue, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.cta, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radii.button },
  btnPrimaryTxt: { color: colors.white, fontWeight: "700" },
});
