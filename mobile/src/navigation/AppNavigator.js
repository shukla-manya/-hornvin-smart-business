import React, { useEffect, useMemo, useRef } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { navigationRef, resetToLoginRegister } from "./navigationRoot";
import { SplashScreen } from "../screens/SplashScreen";
import { RoleSelectionScreen } from "../screens/RoleSelectionScreen";
import { LoginRegisterScreen } from "../screens/LoginRegisterScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { ProductDetailScreen } from "../screens/ProductDetailScreen";
import { PostProductScreen } from "../screens/PostProductScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { ChatListScreen } from "../screens/ChatListScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { DealerMapScreen } from "../screens/DealerMapScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { InvoicesScreen } from "../screens/InvoicesScreen";
import { PaymentsScreen } from "../screens/PaymentsScreen";
import { LocationsScreen } from "../screens/LocationsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { WishlistScreen } from "../screens/WishlistScreen";
import { AdminHomeScreen } from "../screens/AdminHomeScreen";
import { AdminUsersScreen } from "../screens/AdminUsersScreen";
import { AdminOrdersScreen } from "../screens/AdminOrdersScreen";
import { AdminPaymentsScreen } from "../screens/AdminPaymentsScreen";
import { AdminCatalogScreen } from "../screens/AdminCatalogScreen";
import { AdminCategoriesScreen } from "../screens/AdminCategoriesScreen";
import { AdminCouponsScreen } from "../screens/AdminCouponsScreen";
import { AdminPushScreen } from "../screens/AdminPushScreen";
import { AdminUserDetailScreen } from "../screens/AdminUserDetailScreen";
import { AdminOrderDetailScreen } from "../screens/AdminOrderDetailScreen";
import { AdminAnalyticsScreen } from "../screens/AdminAnalyticsScreen";
import { AdminChatHubScreen } from "../screens/AdminChatHubScreen";
import { RewardsScreen } from "../screens/RewardsScreen";
import { DistributorWorkspaceScreen } from "../screens/DistributorWorkspaceScreen";
import { DistributorInventoryScreen } from "../screens/DistributorInventoryScreen";
import { CompanyCatalogScreen } from "../screens/CompanyCatalogScreen";
import { GarageHubScreen } from "../screens/GarageHubScreen";
import { GarageInventoryScreen } from "../screens/GarageInventoryScreen";
import { GarageServiceHistoryScreen } from "../screens/GarageServiceHistoryScreen";
import { GarageRemindersScreen } from "../screens/GarageRemindersScreen";
import { GarageAiCallingScreen } from "../screens/GarageAiCallingScreen";
import { GarageWorkEstimateScreen } from "../screens/GarageWorkEstimateScreen";
import { GarageVehiclesScreen } from "../screens/GarageVehiclesScreen";
import { GarageShopInvoicesScreen } from "../screens/GarageShopInvoicesScreen";
import { PartFinderScreen } from "../screens/PartFinderScreen";
import { ForcePasswordChangeScreen } from "../screens/ForcePasswordChangeScreen";
import { ProfileSetupScreen } from "../screens/ProfileSetupScreen";
import { GarageServiceSelectionScreen } from "../screens/GarageServiceSelectionScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { useAuth } from "../context/AuthContext";
import { getInitialMainTabKey, getVisibleMainTabKeys } from "./roleUi";
import { withStackRouteGuard } from "./withStackRouteGuard";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const GuardedAdminHome = withStackRouteGuard(AdminHomeScreen, "AdminHome");
const GuardedAdminUsers = withStackRouteGuard(AdminUsersScreen, "AdminUsers");
const GuardedAdminOrders = withStackRouteGuard(AdminOrdersScreen, "AdminOrders");
const GuardedAdminPayments = withStackRouteGuard(AdminPaymentsScreen, "AdminPayments");
const GuardedAdminCatalog = withStackRouteGuard(AdminCatalogScreen, "AdminCatalog");
const GuardedAdminCategories = withStackRouteGuard(AdminCategoriesScreen, "AdminCategories");
const GuardedAdminCoupons = withStackRouteGuard(AdminCouponsScreen, "AdminCoupons");
const GuardedAdminPush = withStackRouteGuard(AdminPushScreen, "AdminPush");
const GuardedAdminUserDetail = withStackRouteGuard(AdminUserDetailScreen, "AdminUserDetail");
const GuardedAdminOrderDetail = withStackRouteGuard(AdminOrderDetailScreen, "AdminOrderDetail");
const GuardedAdminAnalytics = withStackRouteGuard(AdminAnalyticsScreen, "AdminAnalytics");
const GuardedAdminChatHub = withStackRouteGuard(AdminChatHubScreen, "AdminChatHub");
const GuardedDistributorWorkspace = withStackRouteGuard(DistributorWorkspaceScreen, "DistributorWorkspace");
const GuardedDistributorInventory = withStackRouteGuard(DistributorInventoryScreen, "DistributorInventory");
const GuardedPostProduct = withStackRouteGuard(PostProductScreen, "PostProduct");
const GuardedInvoices = withStackRouteGuard(InvoicesScreen, "Invoices");
const GuardedGarageInventory = withStackRouteGuard(GarageInventoryScreen, "GarageInventory");
const GuardedGarageServiceHistory = withStackRouteGuard(GarageServiceHistoryScreen, "GarageServiceHistory");
const GuardedGarageReminders = withStackRouteGuard(GarageRemindersScreen, "GarageReminders");
const GuardedGarageAiCalling = withStackRouteGuard(GarageAiCallingScreen, "GarageAiCalling");
const GuardedGarageWorkEstimate = withStackRouteGuard(GarageWorkEstimateScreen, "GarageWorkEstimate");
const GuardedGarageVehicles = withStackRouteGuard(GarageVehiclesScreen, "GarageVehicles");
const GuardedGarageShopInvoices = withStackRouteGuard(GarageShopInvoicesScreen, "GarageShopInvoices");

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.secondaryBlue,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.cta,
  },
};

const headerScreenOptions = {
  headerStyle: { backgroundColor: colors.header },
  headerTintColor: colors.white,
  headerTitleStyle: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 17,
    letterSpacing: 0.25,
  },
  headerShadowVisible: false,
};

const tabIcon = (icon, size = 22) =>
  ({ color }) => <Text style={{ color, fontSize: size }}>{icon}</Text>;

const TAB_REGISTRY = {
  HomeTab: {
    component: HomeScreen,
    options: { title: "Home", tabBarIcon: tabIcon("⌂", 24) },
  },
  GarageTab: {
    component: GarageHubScreen,
    options: { title: "Garage", tabBarIcon: tabIcon("G", 20) },
  },
  ExploreTab: {
    component: MarketplaceScreen,
    options: { title: "Explore", tabBarIcon: tabIcon("◇", 22) },
  },
  ChatTab: {
    component: ChatListScreen,
    options: { title: "Chat", tabBarIcon: tabIcon("💬", 22) },
  },
  OrdersTab: {
    component: OrdersScreen,
    options: { title: "Orders", tabBarIcon: tabIcon("▣", 22) },
  },
  NotificationsTab: {
    component: NotificationsScreen,
    options: { title: "Reminders", tabBarIcon: tabIcon("⏰", 21) },
  },
  ProfileTab: {
    component: ProfileScreen,
    options: { title: "Profile", tabBarIcon: tabIcon("◎", 22) },
  },
};

function MainTabs() {
  const { user, isAuthenticated } = useAuth();
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      resetToLoginRegister();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const insets = useSafeAreaInsets();
  const tabKeys = useMemo(() => getVisibleMainTabKeys(user?.role), [user?.role]);
  const initialRouteName = useMemo(() => {
    const preferred = getInitialMainTabKey(user?.role);
    return tabKeys.includes(preferred) ? preferred : tabKeys[0];
  }, [user?.role, tabKeys]);

  const tabBarBottomPad = Math.max(insets.bottom, 12);
  const tabBarTopPad = 8;
  const tabBarRow = 58;
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: tabBarTopPad,
      paddingBottom: tabBarBottomPad,
      height: tabBarRow + tabBarTopPad + tabBarBottomPad,
      // Shadow for iOS
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      // Elevation for Android
      elevation: 12,
    }),
    [tabBarBottomPad]
  );

  if (!isAuthenticated) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <Tabs.Navigator
      key={tabKeys.join("|")}
      initialRouteName={initialRouteName}
      screenOptions={{
        ...headerScreenOptions,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2, marginTop: 2 },
        tabBarActiveTintColor: colors.secondaryBlue,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      {tabKeys.map((name) => {
        const base = TAB_REGISTRY[name].options;
        const marketplaceTitle = user?.role === "end_user" ? "Explore" : "Marketplace";
        const merged =
          name === "ExploreTab"
            ? { ...base, title: marketplaceTitle, tabBarLabel: marketplaceTitle }
            : name === "OrdersTab" && user?.role === "end_user"
              ? { ...base, title: "Service", tabBarLabel: "Service" }
              : name === "OrdersTab" && user?.role && user.role !== "end_user"
                ? { ...base, tabBarLabel: "Orders" }
                : name === "NotificationsTab"
                  ? { ...base, title: "Reminders", tabBarLabel: "Reminders" }
                  : base;
        return <Tabs.Screen key={name} name={name} component={TAB_REGISTRY[name].component} options={merged} />;
      })}
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          ...headerScreenOptions,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ForcePasswordChange" component={ForcePasswordChangeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="GarageServiceSelection"
          component={GarageServiceSelectionScreen}
          options={({ route }) => ({
            headerShown: route.params?.edit === true,
            title: "Service focus",
          })}
        />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Change password" }} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="LoginRegister" component={LoginRegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="MarketplaceBrowse" component={MarketplaceScreen} options={{ title: "Browse parts" }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "Product" }} />
        <Stack.Screen name="PostProduct" component={GuardedPostProduct} options={{ title: "New product" }} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: "Chat" }} />
        <Stack.Screen name="DealerMap" component={DealerMapScreen} options={{ title: "Dealer locator" }} />
        <Stack.Screen name="Invoices" component={GuardedInvoices} options={{ title: "Invoices" }} />
        <Stack.Screen name="GarageInventory" component={GuardedGarageInventory} options={{ title: "Inventory" }} />
        <Stack.Screen name="GarageServiceHistory" component={GuardedGarageServiceHistory} options={{ title: "Service history" }} />
        <Stack.Screen name="GarageReminders" component={GuardedGarageReminders} options={{ title: "Customers" }} />
        <Stack.Screen name="GarageAiCalling" component={GuardedGarageAiCalling} options={{ title: "AI call assistant" }} />
        <Stack.Screen name="GarageWorkEstimate" component={GuardedGarageWorkEstimate} options={{ title: "Work estimate" }} />
        <Stack.Screen name="GarageVehicles" component={GuardedGarageVehicles} options={{ title: "Vehicles" }} />
        <Stack.Screen name="GarageShopInvoices" component={GuardedGarageShopInvoices} options={{ title: "Shop invoices" }} />
        <Stack.Screen name="PartFinder" component={PartFinderScreen} options={{ title: "Part Finder" }} />
        <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: "Payments" }} />
        <Stack.Screen name="Locations" component={LocationsScreen} options={{ title: "Saved locations" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Wishlist" }} />
        <Stack.Screen name="AdminHome" component={GuardedAdminHome} options={{ title: "Hornvin Admin" }} />
        <Stack.Screen name="AdminUsers" component={GuardedAdminUsers} options={{ title: "Users" }} />
        <Stack.Screen name="AdminUserDetail" component={GuardedAdminUserDetail} options={{ title: "User detail" }} />
        <Stack.Screen name="AdminOrders" component={GuardedAdminOrders} options={{ title: "All orders" }} />
        <Stack.Screen name="AdminOrderDetail" component={GuardedAdminOrderDetail} options={{ title: "Order detail" }} />
        <Stack.Screen name="AdminPayments" component={GuardedAdminPayments} options={{ title: "Transactions" }} />
        <Stack.Screen name="AdminCatalog" component={GuardedAdminCatalog} options={{ title: "Global products" }} />
        <Stack.Screen name="AdminCategories" component={GuardedAdminCategories} options={{ title: "Categories" }} />
        <Stack.Screen name="AdminCoupons" component={GuardedAdminCoupons} options={{ title: "Coupons & rewards" }} />
        <Stack.Screen name="AdminPush" component={GuardedAdminPush} options={{ title: "Push broadcast" }} />
        <Stack.Screen name="AdminAnalytics" component={GuardedAdminAnalytics} options={{ title: "Analytics" }} />
        <Stack.Screen name="AdminChatHub" component={GuardedAdminChatHub} options={{ title: "Distributor chat" }} />
        <Stack.Screen name="Rewards" component={RewardsScreen} options={{ title: "Coupons & rewards" }} />
        <Stack.Screen name="DistributorWorkspace" component={GuardedDistributorWorkspace} options={{ title: "Distributor panel" }} />
        <Stack.Screen name="DistributorInventory" component={GuardedDistributorInventory} options={{ title: "My inventory" }} />
        <Stack.Screen name="CompanyCatalog" component={CompanyCatalogScreen} options={{ title: "Company catalog" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
