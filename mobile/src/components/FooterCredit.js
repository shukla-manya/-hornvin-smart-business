import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export function FooterCredit({ compact }) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityRole="text">
      <Text style={[styles.text, compact && styles.textCompact]}>Made with ♥ love by MANYA SHUKLA · 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapCompact: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.6,
    opacity: 0.9,
  },
  textCompact: {
    fontSize: 11,
  },
});
