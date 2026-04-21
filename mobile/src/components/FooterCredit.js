import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

export function FooterCredit({ compact, global: isGlobal }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        isGlobal && { paddingBottom: Math.max(insets.bottom, 6) + 4, backgroundColor: colors.background },
      ]}
      accessibilityRole="text"
    >
      <Text style={styles.text}>Made with ♥  by MANYA SHUKLA · 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapCompact: {
    paddingVertical: 6,
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
});
