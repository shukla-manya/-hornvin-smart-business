import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Alert, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { resetToLoginRegister } from "../navigation/navigationRoot";
import { profileQuickLinkRoutes } from "../navigation/roleUi";
import { RETAIL_BUSINESS_TYPE_OPTIONS } from "../constants/retailBusinessTypes";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

export function ProfileScreen({ navigation }) {
  const { user, logout, updateProfile, refreshMe } = useAuth();
  const [nameDraft, setNameDraft] = useState(user?.name || "");
  const [businessDraft, setBusinessDraft] = useState(user?.businessName || "");
  const [addressDraft, setAddressDraft] = useState(user?.address || "");
  const [upiVpaDraft, setUpiVpaDraft] = useState(user?.upiVpa || "");
  const [upiNameDraft, setUpiNameDraft] = useState(user?.upiMerchantName || "");
  const [landmarkDraft, setLandmarkDraft] = useState(user?.addressLandmark || "");
  const [stateRegionDraft, setStateRegionDraft] = useState(user?.stateRegion || "");
  const [businessTypeDraft, setBusinessTypeDraft] = useState(user?.businessType || "");
  const [gstDraft, setGstDraft] = useState(user?.gstNumber || "");
  const [savingName, setSavingName] = useState(false);

  const companyProfile = user?.role === "company";
  const showBusinessForm = companyProfile || user?.role === "retail" || user?.role === "distributor";

  useEffect(() => {
    setNameDraft(user?.name || "");
    setBusinessDraft(user?.businessName || "");
    setAddressDraft(user?.address || "");
    setUpiVpaDraft(user?.upiVpa || "");
    setUpiNameDraft(user?.upiMerchantName || "");
    setLandmarkDraft(user?.addressLandmark || "");
    setStateRegionDraft(user?.stateRegion || "");
    setBusinessTypeDraft(user?.businessType || "");
    setGstDraft(user?.gstNumber || "");
  }, [
    user?.name,
    user?.businessName,
    user?.address,
    user?.upiVpa,
    user?.upiMerchantName,
    user?.addressLandmark,
    user?.stateRegion,
    user?.businessType,
    user?.gstNumber,
  ]);

  useFocusEffect(
    useCallback(() => {
      refreshMe().catch(() => {});
    }, [refreshMe])
  );

  const rootNav = navigation.getParent()?.getParent();
  const open = (name, params) => rootNav?.navigate(name, params);
  const openNestedTab = (tabName) => rootNav?.navigate("Main", { screen: tabName });

  const onSaveName = useCallback(async () => {
    setSavingName(true);
    try {
      if (companyProfile) {
        await updateProfile({
          name: nameDraft.trim(),
          businessName: businessDraft.trim(),
          address: addressDraft.trim(),
          upiVpa: upiVpaDraft.trim(),
          upiMerchantName: upiNameDraft.trim(),
        });
        Alert.alert("Saved", "Your profile was updated.");
      } else if (user?.role === "retail") {
        if (!RETAIL_BUSINESS_TYPE_OPTIONS.some((o) => o.id === businessTypeDraft)) {
          Alert.alert("Business type", "Choose one business type chip before saving.");
          return;
        }
        await updateProfile({
          name: nameDraft.trim(),
          businessName: businessDraft.trim(),
          address: addressDraft.trim(),
          addressLandmark: landmarkDraft.trim(),
          stateRegion: stateRegionDraft.trim(),
          businessType: businessTypeDraft,
          gstNumber: gstDraft.trim(),
          upiVpa: upiVpaDraft.trim(),
          upiMerchantName: upiNameDraft.trim(),
        });
        Alert.alert("Saved", "Your profile was updated.");
      } else if (user?.role === "distributor") {
        await updateProfile({
          name: nameDraft.trim(),
          businessName: businessDraft.trim(),
          address: addressDraft.trim(),
          upiVpa: upiVpaDraft.trim(),
          upiMerchantName: upiNameDraft.trim(),
        });
        Alert.alert("Saved", "Your profile was updated.");
      } else {
        await updateProfile({
          name: nameDraft.trim(),
          upiVpa: upiVpaDraft.trim(),
          upiMerchantName: upiNameDraft.trim(),
        });
        Alert.alert("Saved", "Your profile was updated.");
      }
    } catch (e) {
      Alert.alert("Could not save", e.response?.data?.error || e.message);
    } finally {
      setSavingName(false);
    }
  }, [
    companyProfile,
    user?.role,
    nameDraft,
    businessDraft,
    addressDraft,
    landmarkDraft,
    stateRegionDraft,
    businessTypeDraft,
    gstDraft,
    upiVpaDraft,
    upiNameDraft,
    updateProfile,
  ]);

  const onLogout = () => {
    Alert.alert("Logout", "End this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          resetToLoginRegister();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Profile</Text>
      <View style={[styles.card, shadows.card]}>
        {profileQuickLinkRoutes(user).map((link) => (
          <Pressable
            key={link.route || link.nestedTab || link.label}
            onPress={() => (link.nestedTab ? openNestedTab(link.nestedTab) : open(link.route, link.params))}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>{link.label}</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.card, shadows.card, { marginTop: 12 }]}>
        <Row label="Role" value={user?.role?.replace("_", " ")} />
        <Row
          label="Account status"
          value={(() => {
            const ls =
              user?.lifecycleStatus ??
              (user?.status === "approved" || user?.status == null || user?.status === ""
                ? "active"
                : user.status);
            if (ls === "active") return "Active";
            if (ls === "pending") return "Pending approval";
            if (ls === "rejected") return "Rejected";
            if (ls === "blocked") return "Blocked";
            return user?.status || "—";
          })()}
        />
        <Row
          label="Permissions"
          value={
            user?.permissions
              ? `Sell ${user.permissions.canSell !== false ? "on" : "off"} · Products ${user.permissions.canAddProducts !== false ? "on" : "off"} · Buy ${user.permissions.canPlaceOrders !== false ? "on" : "off"}`
              : "—"
          }
        />
        <Row label="Reward points" value={String(user?.rewardPoints ?? 0)} />
        {user?.mustChangePassword ? (
          <Row label="Security" value="Change password on first sign-in (required)" />
        ) : null}
        <Text style={styles.sectionHint}>
          {companyProfile
            ? "Name, business, address, and UPI details (email and phone stay read-only)."
            : showBusinessForm
              ? "Name, business, address, and UPI (email and phone stay read-only)."
              : "Display name and UPI for payment QR (email and phone are read-only)."}
        </Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          placeholderTextColor={colors.textSecondary}
          style={styles.nameInput}
          editable={!savingName}
        />
        {showBusinessForm ? (
          <>
            <TextInput
              value={businessDraft}
              onChangeText={setBusinessDraft}
              placeholder={user?.role === "distributor" ? "Branch / business name" : "Business or shop name"}
              placeholderTextColor={colors.textSecondary}
              style={styles.nameInput}
              editable={!savingName}
            />
            <TextInput
              value={addressDraft}
              onChangeText={setAddressDraft}
              placeholder="Address"
              placeholderTextColor={colors.textSecondary}
              style={[styles.nameInput, { minHeight: 72, textAlignVertical: "top" }]}
              multiline
              editable={!savingName}
            />
            {user?.role === "retail" ? (
              <>
                <Text style={styles.sectionHint}>Landmark & state (shown on maps / invoices)</Text>
                <TextInput
                  value={landmarkDraft}
                  onChangeText={setLandmarkDraft}
                  placeholder="Nearby landmark"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.nameInput}
                  editable={!savingName}
                />
                <TextInput
                  value={stateRegionDraft}
                  onChangeText={setStateRegionDraft}
                  placeholder="State / region"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.nameInput}
                  editable={!savingName}
                />
                <Text style={styles.sectionHint}>Business type</Text>
                <View style={styles.typeRow}>
                  {RETAIL_BUSINESS_TYPE_OPTIONS.map((o) => {
                    const on = businessTypeDraft === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setBusinessTypeDraft(o.id)}
                        disabled={savingName}
                        style={[styles.typeChip, on && styles.typeChipOn]}
                      >
                        <Text style={[styles.typeChipTxt, on && styles.typeChipTxtOn]} numberOfLines={2}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={gstDraft}
                  onChangeText={setGstDraft}
                  placeholder="GSTIN (optional)"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.nameInput}
                  editable={!savingName}
                  autoCapitalize="characters"
                />
              </>
            ) : null}
          </>
        ) : null}
        <Text style={styles.sectionHint}>UPI (shown on your Payments screen QR)</Text>
        <TextInput
          value={upiVpaDraft}
          onChangeText={setUpiVpaDraft}
          placeholder="UPI ID (e.g. shopname@paytm)"
          placeholderTextColor={colors.textSecondary}
          style={styles.nameInput}
          editable={!savingName}
          autoCapitalize="none"
        />
        <TextInput
          value={upiNameDraft}
          onChangeText={setUpiNameDraft}
          placeholder="Payee name on UPI apps"
          placeholderTextColor={colors.textSecondary}
          style={styles.nameInput}
          editable={!savingName}
        />
        <Pressable onPress={onSaveName} disabled={savingName} style={[styles.saveNameBtn, savingName && { opacity: 0.6 }]}>
          {savingName ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveNameBtnText}>Save profile</Text>
          )}
        </Pressable>
        {!showBusinessForm ? <Row label="Business" value={user?.businessName || "—"} /> : null}
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Phone" value={user?.phone || "—"} isLast={companyProfile || showBusinessForm} />
        {!showBusinessForm ? <Row label="Address" value={user?.address || "—"} isLast /> : null}
      </View>
      <Pressable
        onPress={() => open("ChangePassword")}
        style={styles.changePw}
      >
        <Text style={styles.changePwText}>Change password</Text>
      </Pressable>
      <Pressable onPress={onLogout} style={styles.logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
      <FooterCredit />
    </ScrollView>
  );
}

function Row({ label, value, isLast }) {
  return (
    <View style={[styles.row, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  scrollContent: { paddingBottom: 32 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.header, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  value: { color: colors.text, marginTop: 4, fontWeight: "600" },
  changePw: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.secondaryBlue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  changePwText: { color: colors.secondaryBlue, fontWeight: "800" },
  logout: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FEF2F2",
  },
  logoutText: { color: colors.error, fontWeight: "800" },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkText: { color: colors.secondaryBlue, fontWeight: "700" },
  chev: { color: colors.lightBlue, fontSize: 20 },
  sectionHint: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  nameInput: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  saveNameBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: colors.cta,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveNameBtnText: { color: colors.white, fontWeight: "800" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 12, marginBottom: 10 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    maxWidth: "48%",
  },
  typeChipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  typeChipTxt: { color: colors.text, fontWeight: "600", fontSize: 11 },
  typeChipTxtOn: { color: colors.secondaryBlue, fontWeight: "800" },
});
