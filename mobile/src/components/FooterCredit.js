import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

/** Vertical space to reserve above the sticky footer (single source for App.js padding). */
export function stickyFooterReserve(insets) {
  const bottom = Math.max(insets?.bottom ?? 0, 8);
  // ~10 top pad + ~16 line + bottom safe area + hairline
  return Math.ceil(36 + bottom);
}

/**
 * App-level footer: sits at the bottom of the window (used once in App.js).
 * Optional `compact` for tighter padding on dense layouts.
 */
export function FooterCredit({ compact }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, compact ? 4 : 8);

  return (
    <View
      style={[
        styles.bar,
        compact && styles.barCompact,
        { paddingTop: compact ? 6 : 10, paddingBottom: bottomPad },
      ]}
      accessibilityRole="text"
    >
      <Text style={[styles.text, compact && styles.textCompact]}>Made with ♥  by MANYA SHUKLA · 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  barCompact: {
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
    fontSize: 10,
  },
});
