import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";
import { resetAfterAuth } from "../navigation/navigationRoot";
import { RETAIL_BUSINESS_TYPE_OPTIONS } from "../constants/retailBusinessTypes";

async function pickPhotoDataUrl() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Photos", "Allow photo library access to upload your shop and profile pictures.");
    return null;
  }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.35,
    base64: true,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType || "image/jpeg";
  if (!a.base64) {
    Alert.alert("Photos", "Could not read this image. Try another photo.");
    return null;
  }
  return `data:${mime};base64,${a.base64}`;
}

/**
 * After OTP login: profile details, then (for retail) service selection, then dashboard (`resetAfterAuth`).
 */
export function ProfileSetupScreen() {
  const { user, updateProfile } = useAuth();
  const companyLike = user?.role === "company" || user?.isPlatformOwner;
  const retailLike = user?.role === "retail";
  const [name, setName] = useState(user?.name || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [address, setAddress] = useState(user?.address || "");
  const [addressLandmark, setAddressLandmark] = useState(user?.addressLandmark || "");
  const [stateRegion, setStateRegion] = useState(user?.stateRegion || "");
  const [businessType, setBusinessType] = useState(user?.businessType || "");
  const [gstNumber, setGstNumber] = useState(user?.gstNumber || "");
  const [shopPhotoUrl, setShopPhotoUrl] = useState(user?.shopPhotoUrl || "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.profilePhotoUrl || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setBusinessName(user?.businessName || "");
    setAddress(user?.address || "");
    setAddressLandmark(user?.addressLandmark || "");
    setStateRegion(user?.stateRegion || "");
    setBusinessType(user?.businessType || "");
    setGstNumber(user?.gstNumber || "");
    setShopPhotoUrl(user?.shopPhotoUrl || "");
    setProfilePhotoUrl(user?.profilePhotoUrl || "");
  }, [
    user?.name,
    user?.businessName,
    user?.address,
    user?.addressLandmark,
    user?.stateRegion,
    user?.businessType,
    user?.gstNumber,
    user?.shopPhotoUrl,
    user?.profilePhotoUrl,
  ]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("Name", "Enter your full name to continue.");
      return;
    }
    if (retailLike && !businessName.trim()) {
      Alert.alert("Business name", "Enter your garage or shop name as it appears to customers.");
      return;
    }
    if (retailLike) {
      if (!address.trim()) {
        Alert.alert("Address", "Street and area are required.");
        return;
      }
      if (!addressLandmark.trim()) {
        Alert.alert("Landmark", "Add a nearby landmark so customers and drivers can find you.");
        return;
      }
      if (!stateRegion.trim()) {
        Alert.alert("State", "Enter your state or region.");
        return;
      }
      if (!businessType || !RETAIL_BUSINESS_TYPE_OPTIONS.some((o) => o.id === businessType)) {
        Alert.alert("Business type", "Pick how your shop is set up.");
        return;
      }
      if (!shopPhotoUrl.trim() || !profilePhotoUrl.trim()) {
        Alert.alert("Photos", "Add a shop front photo and a photo of yourself (owner / contact).");
        return;
      }
    }
    setBusy(true);
    try {
      let nextUser;
      if (companyLike) {
        nextUser = await updateProfile({
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
        });
      } else if (retailLike) {
        nextUser = await updateProfile({
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
          addressLandmark: addressLandmark.trim(),
          stateRegion: stateRegion.trim(),
          businessType,
          gstNumber: gstNumber.trim(),
          shopPhotoUrl: shopPhotoUrl.trim(),
          profilePhotoUrl: profilePhotoUrl.trim(),
        });
      } else {
        nextUser = await updateProfile({ name: name.trim() });
      }
      resetAfterAuth(nextUser);
    } catch (e) {
      Alert.alert("Profile", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Complete your profile</Text>
        <Text style={styles.sub}>
          {retailLike
            ? "Garage onboarding: business details, photos, then you will pick services you offer before the dashboard."
            : "We need a few details before you can use the app. You can update some of these later in Profile."}
        </Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.textSecondary}
        />

        {companyLike || retailLike ? (
          <>
            <Text style={styles.label}>{retailLike ? "Business / shop name" : "Business name"}</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder={retailLike ? "e.g. City Motors Garage" : "Company or shop name"}
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>{retailLike ? "Address (street & area)" : "Address (optional)"}</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder={retailLike ? "Building, street, area" : "Street, city"}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </>
        ) : null}

        {retailLike ? (
          <>
            <Text style={styles.label}>Landmark</Text>
            <TextInput
              style={styles.input}
              value={addressLandmark}
              onChangeText={setAddressLandmark}
              placeholder="e.g. Opposite city hospital gate"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>State / region</Text>
            <TextInput
              style={styles.input}
              value={stateRegion}
              onChangeText={setStateRegion}
              placeholder="e.g. Maharashtra, Karnataka, NCR"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.label}>Business type</Text>
            <View style={styles.typeGrid}>
              {RETAIL_BUSINESS_TYPE_OPTIONS.map((o) => {
                const on = businessType === o.id;
                return (
                  <Pressable key={o.id} onPress={() => setBusinessType(o.id)} style={[styles.typeChip, on && styles.typeChipOn]}>
                    <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>GST number (optional)</Text>
            <TextInput
              style={styles.input}
              value={gstNumber}
              onChangeText={setGstNumber}
              placeholder="15-character GSTIN if registered"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
            <Text style={styles.label}>Shop photo</Text>
            <Pressable style={styles.photoBox} onPress={async () => setShopPhotoUrl((await pickPhotoDataUrl()) || shopPhotoUrl)}>
              {shopPhotoUrl ? (
                <Image source={{ uri: shopPhotoUrl }} style={styles.photoImg} resizeMode="cover" />
              ) : (
                <Text style={styles.photoHint}>Tap to choose shop front / bay photo</Text>
              )}
            </Pressable>
            <Text style={styles.label}>Your photo</Text>
            <Pressable
              style={styles.photoBox}
              onPress={async () => setProfilePhotoUrl((await pickPhotoDataUrl()) || profilePhotoUrl)}
            >
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.photoImg} resizeMode="cover" />
              ) : (
                <Text style={styles.photoHint}>Tap to add a clear face photo (owner / contact)</Text>
              )}
            </Pressable>
          </>
        ) : null}

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.header },
  sub: { marginTop: 10, color: colors.textSecondary, lineHeight: 21, marginBottom: 8 },
  label: { color: colors.textSecondary, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.card,
    color: colors.text,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: "100%",
  },
  typeChipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  typeChipText: { color: colors.text, fontWeight: "600", fontSize: 12 },
  typeChipTextOn: { color: colors.secondaryBlue, fontWeight: "800" },
  photoBox: {
    minHeight: 140,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  photoImg: { width: "100%", height: 160 },
  photoHint: { padding: 16, color: colors.textSecondary, textAlign: "center", fontWeight: "600" },
  cta: {
    marginTop: 28,
    backgroundColor: colors.cta,
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
