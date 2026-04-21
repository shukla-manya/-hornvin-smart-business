import React, { useLayoutEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { productsApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

function normalizeListingType(v) {
  if (v === "spare_part" || v === "vehicle" || v === "other") return v;
  return "other";
}

const LISTING_CHIPS = [
  { id: "spare_part", label: "Spare part" },
  { id: "vehicle", label: "Vehicle" },
  { id: "other", label: "Other" },
];

export function PostProductScreen({ navigation, route }) {
  const { user } = useAuth();
  const [listingType, setListingType] = useState(() => normalizeListingType(route?.params?.listingType));
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Engine Oil");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    const title =
      listingType === "spare_part" ? "Sell spare part" : listingType === "vehicle" ? "Sell vehicle" : "New listing";
    navigation.setOptions({ title });
  }, [navigation, listingType]);

  if (user?.role !== "company" && user?.role !== "distributor" && user?.role !== "retail") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Only Hornvin company, distributor, or garage (retail) accounts can list marketplace products.</Text>
        <FooterCredit />
      </View>
    );
  }

  if ((user?.role === "distributor" || user?.role === "retail") && !user?.companyId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Link your garage to a Hornvin company before selling on the marketplace.</Text>
        <FooterCredit />
      </View>
    );
  }

  const submit = async () => {
    const p = Number(price);
    const q = Number(quantity);
    if (!name.trim()) return Alert.alert("Validation", "Name is required");
    if (!Number.isFinite(p) || p < 0) return Alert.alert("Validation", "Valid price required");
    if (!Number.isFinite(q) || q < 0) return Alert.alert("Validation", "Valid quantity required");
    setBusy(true);
    try {
      await productsApi.create({
        name: name.trim(),
        category: category.trim(),
        price: p,
        quantity: q,
        description: description.trim(),
        images: [],
        listingType,
      });
      Alert.alert("Saved", "Product is live in the marketplace.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.label}>Listing type</Text>
      <View style={styles.chipRow}>
        {LISTING_CHIPS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setListingType(c.id)}
            style={[styles.chip, listingType === c.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, listingType === c.id && styles.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <Text style={styles.label}>Category</Text>
      <TextInput value={category} onChangeText={setCategory} placeholder="Engine Oil" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <Text style={styles.label}>Price (₹)</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <Text style={styles.label}>Quantity</Text>
      <TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Specs, packaging, OEM notes…"
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
      />
      <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
        <Text style={styles.ctaText}>Publish product</Text>
      </Pressable>
      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: "center" },
  label: { color: colors.textSecondary, marginBottom: 6, marginTop: 12, fontWeight: "600", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  cta: { marginTop: 24, backgroundColor: colors.cta, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800" },
  muted: { color: colors.textSecondary, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: colors.secondaryBlue, fontWeight: "800" },
});
