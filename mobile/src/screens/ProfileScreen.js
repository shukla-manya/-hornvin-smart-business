import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Alert, TextInput, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { resetToLoginRegister } from "../navigation/navigationRoot";
import { profileQuickLinkRoutes } from "../navigation/roleUi";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

export function ProfileScreen({ navigation }) {
  const { user, logout, updateProfileName, updateProfile } = useAuth();
  const [nameDraft, setNameDraft] = useState(user?.name || "");
  const [businessDraft, setBusinessDraft] = useState(user?.businessName || "");
  const [addressDraft, setAddressDraft] = useState(user?.address || "");
  const [savingName, setSavingName] = useState(false);

  const companyProfile = user?.role === "company";

  useEffect(() => {
    setNameDraft(user?.name || "");
    setBusinessDraft(user?.businessName || "");
    setAddressDraft(user?.address || "");
  }, [user?.name, user?.businessName, user?.address]);

  const rootNav = navigation.getParent()?.getParent();
  const open = (name) => rootNav?.navigate(name);
  const openNestedTab = (tabName) => rootNav?.navigate("Main", { screen: tabName });

  const onSaveName = useCallback(async () => {
    setSavingName(true);
    try {
      if (companyProfile) {
        await updateProfile({
          name: nameDraft.trim(),
          businessName: businessDraft.trim(),
          address: addressDraft.trim(),
        });
        Alert.alert("Saved", "Your profile was updated.");
      } else {
        await updateProfileName(nameDraft.trim());
        Alert.alert("Saved", "Your display name was updated.");
      }
    } catch (e) {
      Alert.alert("Could not save", e.response?.data?.error || e.message);
    } finally {
      setSavingName(false);
    }
  }, [companyProfile, nameDraft, businessDraft, addressDraft, updateProfileName, updateProfile]);

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
    <View style={styles.root}>
      <Text style={styles.h1}>Profile</Text>
      <View style={[styles.card, shadows.card]}>
        {profileQuickLinkRoutes(user).map((link) => (
          <Pressable
            key={link.route || link.nestedTab || link.label}
            onPress={() => (link.nestedTab ? openNestedTab(link.nestedTab) : open(link.route))}
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
        {user?.mustChangePassword ? (
          <Row label="Security" value="Change password on first sign-in (required)" />
        ) : null}
        <Text style={styles.sectionHint}>
          {companyProfile
            ? "Name, business, and address (email and phone stay read-only)"
            : "Display name (you can edit; email and phone are read-only)"}
        </Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          placeholderTextColor={colors.textSecondary}
          style={styles.nameInput}
          editable={!savingName}
        />
        {companyProfile ? (
          <>
            <TextInput
              value={businessDraft}
              onChangeText={setBusinessDraft}
              placeholder="Business name"
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
          </>
        ) : null}
        <Pressable onPress={onSaveName} disabled={savingName} style={[styles.saveNameBtn, savingName && { opacity: 0.6 }]}>
          {savingName ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveNameBtnText}>{companyProfile ? "Save profile" : "Save name"}</Text>
          )}
        </Pressable>
        {!companyProfile ? <Row label="Business" value={user?.businessName || "—"} /> : null}
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Phone" value={user?.phone || "—"} isLast={companyProfile} />
        {!companyProfile ? <Row label="Address" value={user?.address || "—"} isLast /> : null}
      </View>
      <Pressable
        onPress={() => navigation.getParent()?.getParent()?.navigate("ChangePassword")}
        style={styles.changePw}
      >
        <Text style={styles.changePwText}>Change password</Text>
      </Pressable>
      <Pressable onPress={onLogout} style={styles.logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
      <FooterCredit />
    </View>
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
});
