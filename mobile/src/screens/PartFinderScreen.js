import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { colors, shadows, radii } from "../theme";
import { partFinderApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { formatDistanceMeters } from "../utils/maps";

export function PartFinderScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [manualQuery, setManualQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access to upload a part image.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.55,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const a = picked.assets[0];
    setImageUri(a.uri);
    setImageBase64(a.base64 || null);
    const mt = a.mimeType || (a.type === "image" ? "image/jpeg" : "image/jpeg");
    setMimeType(mt);
    if (!a.base64) {
      Alert.alert("Photo", "Could not read image data — try another photo or use the text hint only.");
    }
  };

  const identify = async () => {
    if (!imageBase64 && !manualQuery.trim()) {
      Alert.alert("Part Finder", "Add a photo or type what you are looking for (e.g. “brake pad Wagon R”).");
      return;
    }
    setLoading(true);
    setResult(null);
    let lat;
    let lng;
    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch {
      /* optional */
    }
    try {
      const { data } = await partFinderApi.identify({
        imageBase64: imageBase64 || undefined,
        mimeType: imageBase64 ? mimeType : undefined,
        manualQuery: manualQuery.trim() || undefined,
        lat,
        lng,
      });
      if (data.code === "PART_FINDER_NO_AI") {
        Alert.alert("Part Finder", data.message || "Vision not configured on server.");
      }
      setResult(data);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      Alert.alert("Part Finder", msg);
    } finally {
      setLoading(false);
    }
  };

  const goProduct = (id) => {
    const root = navigation.getParent?.()?.getParent?.() || navigation.getParent?.() || navigation;
    root.navigate("ProductDetail", { productId: id });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Part Finder</Text>
      <Text style={styles.sub}>
        Upload a photo of a part, box, or label. We match marketplace listings and show nearby sellers who stock similar items (when
        location is on). Without a server API key, use the text hint field.
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Pressable style={styles.pickBtn} onPress={pickImage}>
          <Text style={styles.pickBtnTxt}>{imageUri ? "Change photo" : "Upload image"}</Text>
        </Pressable>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" /> : null}
        <Text style={styles.label}>Text hint (optional if photo works)</Text>
        <TextInput
          value={manualQuery}
          onChangeText={setManualQuery}
          placeholder="e.g. Bosch oil filter, 5W-30, front brake pads"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Pressable style={styles.primary} onPress={identify} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryTxt}>Match products</Text>}
        </Pressable>
      </View>

      {result ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Results</Text>
          {result.ai ? <Text style={styles.badge}>AI vision</Text> : <Text style={styles.badgeMuted}>Text search</Text>}
          {result.partSummary ? <Text style={styles.summary}>{result.partSummary}</Text> : null}
          {result.categoryHint ? <Text style={styles.meta}>Category hint: {result.categoryHint}</Text> : null}
          {result.searchQuery ? (
            <Text style={styles.meta}>
              Search used: <Text style={styles.mono}>{result.searchQuery}</Text>
            </Text>
          ) : null}
          {!result.locationUsed && (result.nearbySellers || []).length === 0 ? (
            <Text style={styles.warn}>Turn on location to rank nearby sellers with stock.</Text>
          ) : null}

          <Text style={styles.section}>Matching listings</Text>
          {(result.products || []).length === 0 ? (
            <Text style={styles.meta}>No listings matched — try different words or a clearer photo.</Text>
          ) : (
            (result.products || []).map((p) => (
              <Pressable key={p._id} style={styles.rowItem} onPress={() => goProduct(p._id)}>
                <Text style={styles.pname}>{p.name}</Text>
                <Text style={styles.meta}>
                  {p.category} · ₹{p.price} · Qty {p.quantity}
                </Text>
              </Pressable>
            ))
          )}

          <Text style={styles.section}>Nearby sellers (matched stock)</Text>
          {(result.nearbySellers || []).length === 0 ? (
            <Text style={styles.meta}>No sellers with matching in-stock listings in range — open Dealer map for all partners.</Text>
          ) : (
            (result.nearbySellers || []).map((d) => (
              <View key={String(d._id)} style={styles.sellerRow}>
                <Text style={styles.sellerName}>{d.businessName || d.name || "Seller"}</Text>
                <Text style={styles.meta}>
                  {d.role} · {formatDistanceMeters(d.distanceMeters)}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 8, color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.selectionBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
    marginBottom: 12,
  },
  pickBtnTxt: { fontWeight: "800", color: colors.header },
  preview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: colors.border },
  label: { marginTop: 4, fontWeight: "600", color: colors.textSecondary, fontSize: 12 },
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
    marginTop: 16,
    backgroundColor: colors.cta,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
  },
  primaryTxt: { color: colors.white, fontWeight: "800", fontSize: 16 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.header, marginBottom: 8 },
  badge: { alignSelf: "flex-start", fontSize: 11, fontWeight: "800", color: "#166534", backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  badgeMuted: { alignSelf: "flex-start", fontSize: 11, fontWeight: "800", color: colors.textSecondary, backgroundColor: colors.selectionBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  summary: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 8 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  mono: { fontWeight: "700", color: colors.text },
  warn: { marginTop: 8, fontSize: 13, color: colors.warning, fontWeight: "600" },
  section: { marginTop: 16, marginBottom: 8, fontSize: 15, fontWeight: "800", color: colors.header },
  rowItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pname: { fontSize: 16, fontWeight: "700", color: colors.text },
  sellerRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sellerName: { fontSize: 15, fontWeight: "700", color: colors.secondaryBlue },
});
