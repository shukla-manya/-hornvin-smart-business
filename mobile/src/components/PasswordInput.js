import React, { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme";

export function PasswordInput({ value, onChangeText, placeholder, style, autoCapitalize = "none" }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
      <Pressable onPress={() => setVisible((v) => !v)} style={styles.eye} hitSlop={8}>
        <Text style={styles.eyeText}>{visible ? "🙈" : "👁️"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
  },
  eye: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eyeText: { fontSize: 18 },
});
