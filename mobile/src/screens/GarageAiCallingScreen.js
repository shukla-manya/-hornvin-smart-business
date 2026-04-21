import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Share, Alert, ActivityIndicator } from "react-native";
import { colors, shadows, radii } from "../theme";
import { garageApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";

export function GarageAiCallingScreen() {
  const [customerName, setCustomerName] = useState("");
  const [topic, setTopic] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [script, setScript] = useState("");
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setScript("");
    setTips([]);
    try {
      const { data } = await garageApi.aiCallScript({
        customerName: customerName.trim(),
        topic: topic.trim(),
        vehicle: vehicle.trim(),
      });
      setScript(data.script || "");
      setTips(data.tips || []);
    } catch (e) {
      Alert.alert("Generate", e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const shareOut = async () => {
    if (!script) return;
    try {
      await Share.share({ message: script });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>AI call assistant</Text>
      <Text style={styles.sub}>
        Hornvin builds a calm, compliant outbound script from your inputs. Swap in your preferred LLM or telephony provider on
        the server later — today this is deterministic prose so every garage gets value without API keys.
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.label}>Customer name</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Rajesh" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Text style={styles.label}>Topic</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="Follow-up after brake inspection quote"
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Vehicle (optional)</Text>
        <TextInput value={vehicle} onChangeText={setVehicle} placeholder="2022 City ZX — KA01 AB 1234" style={styles.input} placeholderTextColor={colors.textSecondary} />
        <Pressable onPress={generate} style={styles.primary} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryTxt}>Generate script</Text>}
        </Pressable>
      </View>

      {script ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Script</Text>
          <Text style={styles.script}>{script}</Text>
          <Pressable onPress={shareOut} style={styles.secondary}>
            <Text style={styles.secondaryTxt}>Share script</Text>
          </Pressable>
        </View>
      ) : null}

      {tips.length ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Checklist</Text>
          {tips.map((t, i) => (
            <Text key={i} style={styles.tip}>
              • {t}
            </Text>
          ))}
        </View>
      ) : null}

      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: "700", color: colors.header, marginBottom: 10, fontSize: 15 },
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
  primary: {
    marginTop: 18,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  primaryTxt: { color: colors.white, fontWeight: "700", fontSize: 16 },
  script: { color: colors.text, fontSize: 15, lineHeight: 24 },
  secondary: { marginTop: 14, alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.selectionBg, borderRadius: 12, borderWidth: 1, borderColor: colors.selectionBorder },
  secondaryTxt: { color: colors.secondaryBlue, fontWeight: "700" },
  tip: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 8 },
});
