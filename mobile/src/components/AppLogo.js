import React from "react";
import { View, StyleSheet } from "react-native";
import LogoSvg from "../../assets/logo.svg";

/**
 * App mark — loads from assets/logo.svg (vector only, no raster logo in UI).
 * @param {number} size - width/height in dp
 * @param {object} style
 */
export function AppLogo({ size = 56, style }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="Vello logo">
      <LogoSvg width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
