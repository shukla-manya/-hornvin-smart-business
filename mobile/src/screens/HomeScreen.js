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
        ? "Distributor — buy from company, sell to garages"
        : role === "retail"
          ? "Your garage — primary workspace"
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
          <Text style={styles.cardTitle}>Distributor — local network</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>Buy from Hornvin company (stock orders + company catalog); sell to garages you manage.</Text>
            <Text style={styles.panelLine}>Distributor workspace — linked retailers, downstream snapshot, create garage logins.</Text>
            <Text style={styles.panelLine}>Marketplace + Chat — list SKUs and talk with shops and buyers.</Text>
          </View>
        </View>
      ) : null}

      {role === "company" || role === "distributor" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Marketplace — supply chain (Side 2)</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>Flow: Hornvin company → distributor → garage (retail) → end customer.</Text>
            <Text style={styles.panelLine}>Marketplace tab — listings, search, and product pages for ordering.</Text>
            <Text style={styles.panelLine}>Chat — negotiate with downstream garages and buyers; Dealer map for geography.</Text>
          </View>
        </View>
      ) : null}

      {role === "retail" ? (
        <>
          <View style={[styles.card, shadows.card, styles.primaryCard, { marginBottom: 12 }]}>
            <Text style={styles.primaryBadge}>MAIN USER · GARAGE</Text>
            <Text style={styles.cardTitle}>You run both sides in one app</Text>
            <View style={styles.panelBody}>
              <Text style={styles.panelStrong}>Internal tools</Text>
              <Text style={styles.panelLine}>Garage tab — inventory, service history, customer reminders, invoices, estimates, AI call prep.</Text>
              <Text style={styles.panelStrong}>External marketplace</Text>
              <Text style={styles.panelLine}>
                Marketplace tab — buy parts, sell listings, chat with suppliers & buyers, dealer map to find partners.
              </Text>
            </View>
          </View>
          <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
            <Text style={styles.cardTitle}>Distributor → you</Text>
            <View style={styles.panelBody}>
              <Text style={styles.panelLine}>
                Your distributor buys from Hornvin company and supplies you; you sell to drivers and workshops on the marketplace.
              </Text>
            </View>
          </View>
        </>
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
        <Action
          title={role === "end_user" ? "Explore products" : "Marketplace listings"}
          subtitle={role === "end_user" ? "Search, categories, seller info" : "Supply chain catalog + distributor & garage SKUs"}
          onPress={() => navigation.navigate("ExploreTab")}
        />
        <Action title="Orders" subtitle="Track pending → completed" onPress={() => navigation.navigate("OrdersTab")} />
        <Action
          title="Chat"
          subtitle={role === "retail" ? "Suppliers, distributor, buyers" : "Message threads"}
          onPress={() => navigation.navigate("ChatTab")}
        />
        <Action
          title="Dealer locator"
          subtitle={role === "retail" ? "Find suppliers & nearby partners" : "Map and nearby dealers"}
          onPress={() => openStack("DealerMap")}
        />
        {(role === "company" || role === "distributor" || role === "retail") && (
          <Action title="Invoices" subtitle="Create from orders, mark paid" onPress={() => openStack("Invoices")} />
        )}
        {(role === "company" || role === "distributor" || role === "retail") && (
          <Action
            title="Post product"
            subtitle={role === "retail" ? "Sell parts & labour SKUs on the marketplace" : "List catalog items"}
            onPress={() => openStack("PostProduct")}
          />
        )}
        {role === "distributor" && (
          <Action
            title="Distributor panel"
            subtitle="Company catalog, retailers, stock orders"
            onPress={() => openStack("DistributorWorkspace")}
          />
        )}
        {role === "retail" ? (
          <Action
            title="Garage operations"
            subtitle="Inventory · service log · reminders · AI calls · estimates"
            onPress={() => navigation.navigate("GarageTab")}
          />
        ) : null}
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
  primaryCard: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  primaryBadge: {
    marginHorizontal: 12,
    marginTop: 12,
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: colors.header,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.selectionBorder,
  },
  panelStrong: {
    marginTop: 10,
    marginBottom: 4,
    marginHorizontal: 12,
    fontWeight: "800",
    fontSize: 13,
    color: colors.header,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
