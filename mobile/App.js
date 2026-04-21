import "react-native-gesture-handler";
import "@expo/metro-runtime";
import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { FooterCredit } from "./src/components/FooterCredit";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <AppNavigator />
          <FooterCredit global />
        </View>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
