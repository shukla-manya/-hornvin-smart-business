import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { userCanAccessStackRoute } from "./roleUi";
import { colors } from "../theme";

/**
 * Wraps a stack screen so unauthorized roles cannot use the route (UI aligns with server enforcement).
 */
export function withStackRouteGuard(WrappedScreen, routeName) {
  function GuardedStackScreen(props) {
    const { user } = useAuth();
    const navigation = useNavigation();
    const allowed = userCanAccessStackRoute(user, routeName);

    if (!allowed) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Not available</Text>
          <Text style={styles.body}>This area is not enabled for your account type.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.btn}>
            <Text style={styles.btnText}>Go back</Text>
          </Pressable>
        </View>
      );
    }
    return <WrappedScreen {...props} />;
  }
  GuardedStackScreen.displayName = `Guarded(${routeName})`;
  return GuardedStackScreen;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.header },
  body: { marginTop: 10, color: colors.textSecondary, lineHeight: 22 },
  btn: {
    marginTop: 24,
    alignSelf: "flex-start",
    backgroundColor: colors.secondaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  btnText: { color: colors.white, fontWeight: "800" },
});
