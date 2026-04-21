import React, { useMemo } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { colors } from "../theme";
import { navigationRef } from "./navigationRoot";
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
import { DistributorWorkspaceScreen } from "../screens/DistributorWorkspaceScreen";
import { CompanyCatalogScreen } from "../screens/CompanyCatalogScreen";
import { GarageHubScreen } from "../screens/GarageHubScreen";
import { GarageInventoryScreen } from "../screens/GarageInventoryScreen";
import { GarageServiceHistoryScreen } from "../screens/GarageServiceHistoryScreen";
import { GarageRemindersScreen } from "../screens/GarageRemindersScreen";
import { GarageAiCallingScreen } from "../screens/GarageAiCallingScreen";
import { GarageWorkEstimateScreen } from "../screens/GarageWorkEstimateScreen";
import { ForcePasswordChangeScreen } from "../screens/ForcePasswordChangeScreen";
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
const GuardedDistributorWorkspace = withStackRouteGuard(DistributorWorkspaceScreen, "DistributorWorkspace");
const GuardedPostProduct = withStackRouteGuard(PostProductScreen, "PostProduct");
const GuardedInvoices = withStackRouteGuard(InvoicesScreen, "Invoices");
const GuardedGarageInventory = withStackRouteGuard(GarageInventoryScreen, "GarageInventory");
const GuardedGarageServiceHistory = withStackRouteGuard(GarageServiceHistoryScreen, "GarageServiceHistory");
const GuardedGarageReminders = withStackRouteGuard(GarageRemindersScreen, "GarageReminders");
const GuardedGarageAiCalling = withStackRouteGuard(GarageAiCallingScreen, "GarageAiCalling");
const GuardedGarageWorkEstimate = withStackRouteGuard(GarageWorkEstimateScreen, "GarageWorkEstimate");

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

const TAB_REGISTRY = {
  HomeTab: {
    component: HomeScreen,
    options: { title: "Home", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 18 }}>⌂</Text> },
  },
  GarageTab: {
    component: GarageHubScreen,
    options: { title: "Garage", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 15, fontWeight: "800" }}>G</Text> },
  },
  ExploreTab: {
    component: MarketplaceScreen,
    options: { title: "Explore", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 16 }}>◇</Text> },
  },
  ChatTab: {
    component: ChatListScreen,
    options: { title: "Chat", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 16 }}>💬</Text> },
  },
  OrdersTab: {
    component: OrdersScreen,
    options: { title: "Orders", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 16 }}>▣</Text> },
  },
  ProfileTab: {
    component: ProfileScreen,
    options: { title: "Profile", tabBarIcon: () => <Text style={{ color: colors.header, fontSize: 16 }}>◎</Text> },
  },
};

function MainTabs() {
  const { user } = useAuth();
  const tabKeys = useMemo(() => getVisibleMainTabKeys(user?.role), [user?.role]);
  const initialRouteName = useMemo(() => {
    const preferred = getInitialMainTabKey(user?.role);
    return tabKeys.includes(preferred) ? preferred : tabKeys[0];
  }, [user?.role, tabKeys]);

  return (
    <Tabs.Navigator
      key={tabKeys.join("|")}
      initialRouteName={initialRouteName}
      screenOptions={{
        ...headerScreenOptions,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 58,
          paddingTop: 4,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
        tabBarActiveTintColor: colors.header,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      {tabKeys.map((name) => {
        const base = TAB_REGISTRY[name].options;
        const marketplaceTitle = user?.role === "end_user" ? "Explore" : "Marketplace";
        const merged =
          name === "ExploreTab"
            ? { ...base, title: marketplaceTitle, tabBarLabel: marketplaceTitle }
            : name === "OrdersTab" && user?.role && user.role !== "end_user"
              ? { ...base, tabBarLabel: "Orders" }
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
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Change password" }} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="LoginRegister" component={LoginRegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "Product" }} />
        <Stack.Screen name="PostProduct" component={GuardedPostProduct} options={{ title: "New product" }} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: "Chat" }} />
        <Stack.Screen name="DealerMap" component={DealerMapScreen} options={{ title: "Dealer locator" }} />
        <Stack.Screen name="Invoices" component={GuardedInvoices} options={{ title: "Invoices" }} />
        <Stack.Screen name="GarageInventory" component={GuardedGarageInventory} options={{ title: "Inventory" }} />
        <Stack.Screen name="GarageServiceHistory" component={GuardedGarageServiceHistory} options={{ title: "Service history" }} />
        <Stack.Screen name="GarageReminders" component={GuardedGarageReminders} options={{ title: "Customers & reminders" }} />
        <Stack.Screen name="GarageAiCalling" component={GuardedGarageAiCalling} options={{ title: "AI call assistant" }} />
        <Stack.Screen name="GarageWorkEstimate" component={GuardedGarageWorkEstimate} options={{ title: "Work estimate" }} />
        <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: "Payments" }} />
        <Stack.Screen name="Locations" component={LocationsScreen} options={{ title: "Saved locations" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Wishlist" }} />
        <Stack.Screen name="AdminHome" component={GuardedAdminHome} options={{ title: "Super Admin" }} />
        <Stack.Screen name="AdminUsers" component={GuardedAdminUsers} options={{ title: "Users" }} />
        <Stack.Screen name="AdminOrders" component={GuardedAdminOrders} options={{ title: "All orders" }} />
        <Stack.Screen name="AdminPayments" component={GuardedAdminPayments} options={{ title: "Transactions" }} />
        <Stack.Screen name="AdminCatalog" component={GuardedAdminCatalog} options={{ title: "Global products" }} />
        <Stack.Screen name="AdminCategories" component={GuardedAdminCategories} options={{ title: "Categories" }} />
        <Stack.Screen name="DistributorWorkspace" component={GuardedDistributorWorkspace} options={{ title: "Distributor" }} />
        <Stack.Screen name="CompanyCatalog" component={CompanyCatalogScreen} options={{ title: "Company catalog" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
