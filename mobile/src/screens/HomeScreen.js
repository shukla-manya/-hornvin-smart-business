import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows, radii } from "../theme";

function Action({ title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.actionSub}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role;
  const openStack = (name) => navigation.getParent()?.getParent()?.navigate(name);

  const headline =
    role === "company"
      ? "Hornvin company control center"
      : role === "distributor"
        ? "Stock & downstream orders"
        : role === "retail"
          ? "Garage / shop workspace"
          : "Discover products & nearby dealers";

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.h1}>Welcome{user?.name ? `, ${user.name}` : ""}</Text>
      <Text style={styles.sub}>{headline}</Text>

      {role === "end_user" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>End user panel</Text>
          <View style={styles.panelBody}>
          <Text style={styles.panelLine}>Browse the marketplace (Explore)</Text>
          <Text style={styles.panelLine}>Find dealers nearby (Dealer locator)</Text>
          <Text style={styles.panelLine}>Chat with sellers or shops</Text>
          <Text style={styles.panelLine}>Send an inquiry from any product — “Message seller (inquiry)”</Text>
        </View>
        </View>
      ) : null}

      {role === "distributor" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Distributor panel</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>Dashboard link below: company catalog, stock orders, retailers, limited reports</Text>
            <Text style={styles.panelLine}>Post product and Explore — list SKUs and sell downstream</Text>
            <Text style={styles.panelLine}>Orders tab — confirm and ship buyer orders; buy stock from your company catalog</Text>
          </View>
        </View>
      ) : null}

      {role === "retail" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Retail / garage panel</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>
              Order from your upstream company: Company catalog (Dashboard) uses Buy stock; use Explore for the full marketplace.
            </Text>
            <Text style={styles.panelLine}>Orders tab — track purchases and sales with distributors and buyers</Text>
            <Text style={styles.panelLine}>Invoices — create from orders, mark paid (Dashboard)</Text>
            <Text style={styles.panelLine}>Chat — message your distributor, company, or customers</Text>
          </View>
        </View>
      ) : null}

      {role === "company" && user?.isPlatformOwner ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Approvals</Text>
          <Text style={styles.hint}>
            As the sole Hornvin Super Admin, approve pending garages here: Profile → Super Admin → Users (filter Pending).
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Dashboard</Text>
        <Action title="Explore products" subtitle="Search, categories, seller info" onPress={() => navigation.navigate("ExploreTab")} />
        <Action title="Orders" subtitle="Track pending → completed" onPress={() => navigation.navigate("OrdersTab")} />
        <Action title="Chat" subtitle="Message threads" onPress={() => navigation.navigate("ChatTab")} />
        <Action title="Dealer locator" subtitle="Map and nearby dealers" onPress={() => openStack("DealerMap")} />
        {(role === "company" || role === "distributor" || role === "retail") && (
          <Action title="Invoices" subtitle="Create from orders, mark paid" onPress={() => openStack("Invoices")} />
        )}
        {(role === "company" || role === "distributor") && (
          <Action title="Post product" subtitle="List catalog items" onPress={() => openStack("PostProduct")} />
        )}
        {role === "distributor" && (
          <Action
            title="Distributor panel"
            subtitle="Company catalog, retailers, stock orders"
            onPress={() => openStack("DistributorWorkspace")}
          />
        )}
        {role === "retail" && user?.companyId ? (
          <Action
            title="Company catalog"
            subtitle="Buy stock from your linked company (upstream)"
            onPress={() => openStack("CompanyCatalog")}
          />
        ) : null}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Role</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{role?.replace("_", " ")}</Text>
        </View>
        <Text style={styles.hint}>
          Chain: Hornvin company (Super Admin) → distributor → garage (retail) → end customer. Distributors are created only by
          the Super Admin; distributors create garage accounts. Pending self-signups are approved only in the Super Admin panel.
        </Text>
      </View>
      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  h1: { fontSize: 26, fontWeight: "600", color: colors.text, letterSpacing: -0.3 },
  sub: { marginTop: 8, color: colors.textSecondary, marginBottom: 18, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  cardTitle: { color: colors.header, fontWeight: "600", marginBottom: 4, marginHorizontal: 12, marginTop: 12, fontSize: 15, letterSpacing: 0.2 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionTitle: { color: colors.text, fontWeight: "500" },
  actionSub: { color: colors.textSecondary, marginTop: 3, fontSize: 13, lineHeight: 18 },
  chev: { color: colors.secondaryBlue, fontSize: 20, fontWeight: "300", opacity: 0.85 },
  rolePill: {
    alignSelf: "flex-start",
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.selectionBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
  },
  rolePillText: { color: colors.header, fontWeight: "600", textTransform: "capitalize" },
  hint: { marginTop: 10, marginHorizontal: 12, marginBottom: 12, color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
  panelBody: { paddingHorizontal: 12, paddingBottom: 12 },
  panelLine: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.selectionBorder,
  },
});
