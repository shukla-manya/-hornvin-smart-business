import "react-native-gesture-handler";
import "@expo/metro-runtime";
import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { FooterCredit, stickyFooterReserve } from "./src/components/FooterCredit";
import { colors } from "./src/theme";

/**
 * Native stack screens often paint above plain RN siblings. Keep the footer in an
 * absolutely positioned layer with elevation/zIndex, and reserve bottom inset so
 * scroll/content is not hidden behind it.
 */
function AppLayout() {
  const insets = useSafeAreaInsets();
  const reserve = stickyFooterReserve(insets);

  return (
    <View style={styles.root}>
      <View style={[styles.navSlot, { paddingBottom: reserve }]}>
        <AppNavigator />
      </View>
      <View style={styles.footerLayer} pointerEvents="box-none">
        <FooterCredit />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppLayout />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  navSlot: { flex: 1 },
  footerLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
    backgroundColor: colors.card,
  },
});
