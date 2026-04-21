import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { colors, shadows, radii } from "../theme";
import { ordersApi, paymentsApi, productsApi, garageApi, dealerLocatorApi, usersApi } from "../api/resources";

const ACTIVE_ORDER_STATUSES = new Set(["pending", "confirmed", "shipped"]);

function orderInvolvesUser(order, userId) {
  if (!userId || !order) return false;
  const b = order.buyerId;
  const s = order.sellerId;
  const bid = typeof b === "string" ? b : b?.id || b?._id;
  const sid = typeof s === "string" ? s : s?.id || s?._id;
  return String(bid) === String(userId) || String(sid) === String(userId);
}

function DashboardRow({ title, value, subtitle, onPress, alertTone }) {
  return (
    <Pressable onPress={onPress} style={[styles.dashRow, alertTone && styles.dashRowAlert]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dashTitle}>{title}</Text>
        <Text style={[styles.dashValue, alertTone && styles.dashValueAlert]}>{value}</Text>
        {subtitle ? <Text style={styles.dashSub}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

function SectionHeader({ emoji, label, tone }) {
  return (
    <View style={[styles.sectionHead, tone === "business" ? styles.sectionHeadBiz : styles.sectionHeadMkt]}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={[styles.sectionLabel, tone === "business" ? styles.sectionLabelBiz : styles.sectionLabelMkt]}>
        {label}
      </Text>
    </View>
  );
}

export function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role;
  const userId = user?.id;
  const openStack = (name, params) => navigation.getParent()?.getParent()?.navigate(name, params);

  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [lowStock, setLowStock] = useState(null);
  const [remindersSoon, setRemindersSoon] = useState(null);
  const [productSample, setProductSample] = useState(0);
  const [nearbyDistributors, setNearbyDistributors] = useState(null);
  const [distWorkspace, setDistWorkspace] = useState(null);

  const showMergedDashboard = role === "retail" || role === "company" || role === "distributor" || role === "end_user";

  const loadDashboard = useCallback(async () => {
    if (!showMergedDashboard || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const requests = [
        ordersApi.list().catch(() => ({ data: { orders: [] } })),
        paymentsApi.list().catch(() => ({ data: { payments: [] } })),
        productsApi.list({}).catch(() => ({ data: { products: [] } })),
      ];
      if (role === "retail") {
        requests.push(garageApi.summary().catch(() => null));
      } else {
        requests.push(Promise.resolve(null));
      }
      if (role === "distributor") {
        requests.push(usersApi.workspaceSummary().catch(() => null));
      } else {
        requests.push(Promise.resolve(null));
      }

      const [ordersRes, payRes, prodRes, garageRes, wsRes] = await Promise.all(requests);
      const orders = ordersRes.data?.orders || [];
      const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status) && orderInvolvesUser(o, userId));
      setActiveOrders(active.length);

      const payments = payRes.data?.payments || [];
      setPendingPayments(payments.filter((p) => p.status === "pending").length);

      const products = prodRes.data?.products || [];
      setProductSample(products.length);

      if (garageRes?.data) {
        setLowStock(garageRes.data.lowStockCount ?? 0);
        setRemindersSoon(garageRes.data.remindersDueSoon ?? 0);
      } else {
        setLowStock(null);
        setRemindersSoon(null);
      }

      if (wsRes?.data) {
        setDistWorkspace(wsRes.data);
      } else {
        setDistWorkspace(null);
      }

      const coords = user?.location?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const [lng, lat] = coords;
        try {
          const { data } = await dealerLocatorApi.nearby({ lat, lng, role: "distributor" });
          setNearbyDistributors((data.dealers || []).length);
        } catch {
          setNearbyDistributors(null);
        }
      } else {
        setNearbyDistributors(null);
      }
    } finally {
      setLoading(false);
    }
  }, [role, userId, user?.location?.coordinates, showMergedDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const headline =
    role === "company"
      ? "Hornvin company control center"
      : role === "distributor"
        ? "Distributor — buy from company, sell to garages"
        : role === "retail"
          ? "Your garage — primary workspace"
          : role === "end_user"
            ? "Service, invoices, chat & reminders"
            : "Discover products & nearby dealers";

  const workSubtitle =
    role === "end_user"
      ? "Garage and marketplace orders you are part of — status, pickup, and messages"
      : role === "distributor" && distWorkspace != null
        ? `${distWorkspace.ordersOpenAsSeller ?? 0} selling · ${distWorkspace.ordersOpenAsBuyer ?? 0} buying · ${distWorkspace.pendingApprovalCount ?? 0} shops pending approval`
        : role === "distributor"
          ? "Open orders from your account; link to company for workspace totals"
          : remindersSoon != null && remindersSoon > 0
            ? `${remindersSoon} customer reminder(s) due soon — tap for garage`
            : "Orders you need to move or receive";

  const workValue =
    role === "distributor" && distWorkspace != null
      ? `${(distWorkspace.ordersOpenAsSeller || 0) + (distWorkspace.ordersOpenAsBuyer || 0)} open`
      : `${activeOrders} active`;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.h1}>Welcome{user?.name ? `, ${user.name}` : ""}</Text>
      <Text style={styles.sub}>{headline}</Text>

      {showMergedDashboard ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.secondaryBlue} />
              <Text style={styles.loadingTxt}>Loading dashboard…</Text>
            </View>
          ) : null}

          <SectionHeader emoji={role === "end_user" ? "📋" : "🟢"} label={role === "end_user" ? "Service & pay" : "Business"} tone="business" />

          <DashboardRow
            title={role === "end_user" ? "Your service" : "Today's work"}
            value={workValue}
            subtitle={workSubtitle}
            onPress={() => navigation.navigate("OrdersTab")}
          />
          <DashboardRow
            title="Pending payments"
            value={pendingPayments > 0 ? `${pendingPayments} to settle` : "All clear"}
            subtitle="Cash, UPI, bank, card — mark completed when done"
            onPress={() => openStack("Payments")}
            alertTone={pendingPayments > 0}
          />
          <DashboardRow
            title="Low stock alert"
            value={role === "retail" && lowStock != null ? (lowStock > 0 ? `${lowStock} SKU(s) at or below reorder` : "No low-stock SKUs") : "—"}
            subtitle={role === "retail" ? "Garage inventory vs reorder level" : "Retail garage accounts see live stock alerts"}
            onPress={() => {
              if (role === "retail") openStack("GarageInventory");
              else navigation.navigate("ExploreTab");
            }}
            alertTone={role === "retail" && lowStock > 0}
          />

          <View style={styles.sectionDivider} />

          <SectionHeader emoji="🔵" label="Marketplace" tone="marketplace" />

          <DashboardRow
            title="Products"
            value={productSample >= 100 ? "100+ listings" : `${productSample} in feed`}
            subtitle="Search, categories, buy & sell"
            onPress={() => navigation.navigate("ExploreTab")}
          />
          <DashboardRow
            title="Nearby distributors"
            value={nearbyDistributors != null ? `${nearbyDistributors} on map` : "Set location"}
            subtitle={
              nearbyDistributors != null
                ? "Based on your saved map location"
                : "Allow location in Dealer locator to count nearby partners"
            }
            onPress={() => openStack("DealerMap")}
          />
          {role === "end_user" ? (
            <>
              <DashboardRow
                title="Invoices"
                value="View & pay"
                subtitle="Bills from garages and sellers — mark paid when settled"
                onPress={() => openStack("Invoices")}
              />
              <DashboardRow
                title="Chat"
                value="Garage & seller"
                subtitle="Continue conversations about service and orders"
                onPress={() => navigation.navigate("ChatTab")}
              />
            </>
          ) : null}
          {role === "retail" ? (
            <>
              <DashboardRow
                title="Part finder"
                value="Image → SKU"
                subtitle="Upload a part photo, match catalog, see nearby sellers"
                onPress={() => openStack("PartFinder")}
              />
              <DashboardRow
                title="Coupons & rewards"
                value={user?.rewardPoints != null ? `${user.rewardPoints} pts` : "—"}
                subtitle="Redeem Hornvin offers and track points"
                onPress={() => openStack("Rewards")}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {role === "distributor" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Distributor panel</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>
              Hornvin company → you (stock + fulfilment) → garages. Accept or reject garage orders in Orders; bill with
              Invoices; track money in Payments; message company & shops from Chat.
            </Text>
          </View>
          <Action title="Distributor workspace" subtitle="Dashboard, retailers, stock & chat shortcuts" onPress={() => openStack("DistributorWorkspace")} />
          <Action title="Company catalog" subtitle="Browse Hornvin SKUs and place stock orders" onPress={() => openStack("CompanyCatalog")} />
          <Action title="My inventory" subtitle="Your listed SKUs, quantities, low-stock alerts" onPress={() => openStack("DistributorInventory")} />
          <Action title="Orders" subtitle="Garage purchases + your stock buys — status & accept/reject" onPress={() => navigation.navigate("OrdersTab")} />
          <Action title="Invoices" subtitle="Generate from completed orders for garages" onPress={() => openStack("Invoices")} />
          <Action title="Payments" subtitle="Track what garages pay you (UPI, cash, …)" onPress={() => openStack("Payments")} />
          <Action title="Nearby garages" subtitle="Dealer map filtered to retail" onPress={() => openStack("DealerMap", { initialRole: "retail" })} />
        </View>
      ) : null}

      {role === "company" || role === "distributor" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Marketplace — supply chain (Side 2)</Text>
          <View style={styles.panelBody}>
            <Text style={styles.panelLine}>
              Stock: your global catalog and fulfilment → distributors → garage stock. Service & marketplace sit alongside for
              the full picture.
            </Text>
            <Text style={styles.panelLine}>Marketplace tab — listings, search, and product pages for ordering.</Text>
            <Text style={styles.panelLine}>Super Admin approves garages, manages distributors, coupons, push, analytics.</Text>
          </View>
        </View>
      ) : null}

      {role === "retail" ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Garage — how Hornvin fits together</Text>
          <Text style={styles.flowLead}>
            You are the main user: internal bay tools plus marketplace. Company = Super Admin, distributor = supplier, end
            customer = light role (service & pay).
          </Text>
          {Array.isArray(user?.garageServices) && user.garageServices.length > 0 ? (
            <Text style={styles.flowTags}>Your focus: {user.garageServices.map((s) => s.replace(/_/g, " ")).join(" · ")}</Text>
          ) : null}
          <View style={styles.panelBody}>
            <FlowLink
              title="Stock flow"
              body="Company catalog / distributor supply → log parts in Garage inventory (reorder alerts)."
              onPress={() => openStack("GarageInventory")}
            />
            {user?.companyId ? (
              <FlowLink
                title="Buy stock upstream"
                body="Linked Hornvin company catalog — order into your shop."
                onPress={() => openStack("CompanyCatalog")}
              />
            ) : null}
            <FlowLink
              title="Service flow"
              body="Customer → estimates → shop invoice → Payments (UPI & tracking)."
              onPress={() => navigation.navigate("GarageTab")}
            />
            <FlowLink
              title="Marketplace flow"
              body="Browse distributor listings → place order → track in Orders & chat supplier."
              onPress={() => navigation.navigate("ExploreTab")}
            />
          </View>
        </View>
      ) : null}

      {role === "company" && user?.isPlatformOwner ? (
        <View style={[styles.card, shadows.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>Approvals</Text>
          <Text style={styles.hint}>
            As the sole Hornvin Super Admin, approve pending garages here: Profile → Hornvin Admin → Users (filter Pending).
          </Text>
        </View>
      ) : null}

      {role === "end_user" ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Your Hornvin (customer)</Text>
          <Text style={styles.hint}>
            Light role: track service and orders, get reminders, pay and view invoices, and message your garage or seller.
          </Text>
          <Action
            title="Service"
            subtitle="Orders and service status from your garage or marketplace"
            onPress={() => navigation.navigate("OrdersTab")}
          />
          <Action title="Chat with garage" subtitle="Threads with garages and sellers" onPress={() => navigation.navigate("ChatTab")} />
          <Action title="Invoices" subtitle="View bills and mark paid when you have paid" onPress={() => openStack("Invoices")} />
          <Action title="Pay" subtitle="Payments you make or track" onPress={() => openStack("Payments")} />
          <Action title="Reminders" subtitle="Push setup and alert feed" onPress={() => navigation.navigate("NotificationsTab")} />
          <Action
            title="Browse parts (optional)"
            subtitle="Only when you need to shop"
            onPress={() => openStack("MarketplaceBrowse")}
          />
        </View>
      ) : (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>More</Text>
          <Action
            title="Marketplace listings"
            subtitle="Supply chain catalog + distributor & garage SKUs"
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
      )}

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Role</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{role?.replace("_", " ")}</Text>
        </View>
        <Text style={styles.hint}>
          {role === "end_user"
            ? "Light customer role: Service tab for orders, Chat tab to message your garage or seller, Invoices for bills you receive, Reminders for push and alerts, Profile for payments and optional browsing."
            : "Chain: Hornvin company (Super Admin) → distributor → garage (retail) → end customer. Distributors are created only by the Super Admin; distributors create garage accounts. Pending self-signups are approved only in the Super Admin panel."}
        </Text>
      </View>
    </ScrollView>
  );
}

function FlowLink({ title, body, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.flowLink}>
      <Text style={styles.flowLinkTitle}>{title}</Text>
      <Text style={styles.flowLinkBody}>{body}</Text>
      <Text style={styles.flowLinkChev}>›</Text>
    </Pressable>
  );
}

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  h1: { fontSize: 26, fontWeight: "600", color: colors.text, letterSpacing: -0.3 },
  sub: { marginTop: 8, color: colors.textSecondary, marginBottom: 18, fontSize: 15, lineHeight: 22 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  loadingTxt: { color: colors.textSecondary, fontSize: 13 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  sectionHeadBiz: { backgroundColor: "#ECFDF5" },
  sectionHeadMkt: { backgroundColor: "#EFF6FF" },
  sectionEmoji: { fontSize: 16 },
  sectionLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  sectionLabelBiz: { color: "#15803d" },
  sectionLabelMkt: { color: colors.secondaryBlue },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
    marginHorizontal: 12,
  },
  dashRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dashRowAlert: { backgroundColor: "#FFFBEB" },
  dashTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  dashValue: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  dashValueAlert: { color: "#B45309" },
  dashSub: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
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
  flowLead: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  flowTags: {
    marginHorizontal: 12,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.header,
    textTransform: "capitalize",
  },
  flowLink: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    position: "relative",
  },
  flowLinkTitle: { fontWeight: "800", color: colors.header, fontSize: 14 },
  flowLinkBody: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 18, paddingRight: 8 },
  flowLinkChev: { position: "absolute", right: 12, top: 20, fontSize: 20, color: colors.secondaryBlue },
});
