import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { AppLogo } from "../components/AppLogo";
import { colors } from "../theme";

const MIN_MS = 900;

export function SplashScreen() {
  const navigation = useNavigation();
  const { booting, isAuthenticated, user } = useAuth();
  const mustChangePassword = Boolean(isAuthenticated && user?.mustChangePassword);
  const needsProfileSetup = Boolean(isAuthenticated && user?.needsProfileSetup);

  useEffect(() => {
    if (booting) return;

    const go = () => {
      const target = mustChangePassword
        ? "ForcePasswordChange"
        : needsProfileSetup
          ? "ProfileSetup"
          : isAuthenticated
            ? "Main"
            : "LoginRegister";
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: target }],
        })
      );
    };

    const t = setTimeout(go, MIN_MS);
    return () => clearTimeout(t);
  }, [booting, isAuthenticated, mustChangePassword, needsProfileSetup, navigation]);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <AppLogo size={88} />
      <Text style={styles.wordmark}>Vello</Text>
      <Text style={styles.tag}>Trade · Chat · Orders · Dealers</Text>
      <View style={styles.spinnerWrap}>
        {booting ? <ActivityIndicator size="large" color={colors.white} /> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  wordmark: { marginTop: 22, fontSize: 34, fontWeight: "600", color: colors.white, letterSpacing: 4 },
  tag: {
    marginTop: 14,
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 2,
  },
  spinnerWrap: { marginTop: 36, height: 40, justifyContent: "center" },
});
