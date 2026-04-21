import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { adminApi } from "../api/resources";
import { colors, shadows, radii } from "../theme";
import { FooterCredit } from "../components/FooterCredit";

const ROLES = ["", "company", "distributor", "retail", "end_user"];

export function AdminPushScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!title.trim() || !body.trim()) return Alert.alert("Push", "Title and body are required.");
    setBusy(true);
    setResult(null);
    try {
      const { data } = await adminApi.pushBroadcast({
        title: title.trim(),
        body: body.trim(),
        role: role || undefined,
      });
      setResult(data);
      Alert.alert("Push", `Queued for ${data.audienceCount} users. Check Expo logs if push is disabled on server.`);
    } catch (e) {
      Alert.alert("Push", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Push broadcast</Text>
      <Text style={styles.sub}>
        Sends an Expo push to approved users. Requires EXPO_ACCESS_TOKEN and PUSH_SEND_ENABLED on the server. Optionally limit by
        role.
      </Text>
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.label}>Title *</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Body *</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Role filter (optional)</Text>
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Pressable key={r || "all"} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipOn]}>
              <Text style={[styles.chipTxt, role === r && styles.chipTxtOn]}>{r || "All roles"}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={send} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnTxt}>Send broadcast</Text>}
        </Pressable>
      </View>
      {result ? (
        <Text style={styles.result}>Audience: {result.audienceCount}</Text>
      ) : null}
      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  card: { padding: 16, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  label: { marginTop: 12, fontWeight: "600", color: colors.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 12, marginTop: 6, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.header, borderColor: colors.header },
  chipTxt: { fontSize: 12, fontWeight: "700", color: colors.text },
  chipTxtOn: { color: colors.white },
  btn: { marginTop: 18, backgroundColor: colors.cta, paddingVertical: 14, borderRadius: radii.button, alignItems: "center" },
  btnTxt: { color: colors.white, fontWeight: "800", fontSize: 16 },
  result: { marginTop: 12, color: colors.textSecondary },
});
