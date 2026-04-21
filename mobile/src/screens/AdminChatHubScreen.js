import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminApi, chatApi } from "../api/resources";
import { colors, shadows } from "../theme";

/**
 * Super Admin: start DM threads with distributors to resolve supply issues.
 */
export function AdminChatHubScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(null);

  const load = useCallback(async () => {
    const { data } = await adminApi.users({ role: "distributor", status: "approved", limit: 100 });
    setRows(data.users || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openChat = async (id) => {
    setOpening(id);
    try {
      const { data } = await chatApi.openRoom(id);
      navigation.navigate("ChatRoom", { room: data.room });
    } catch (e) {
      Alert.alert("Chat", e.response?.data?.error || e.message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>Pick a distributor to open (or resume) a private chat thread.</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.secondaryBlue} /> : null}
      <FlatList
        data={rows}
        keyExtractor={(u) => String(u._id || u.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No approved distributors</Text> : null}
        renderItem={({ item: u }) => {
          const id = u._id || u.id;
          const busyRow = opening === id;
          return (
            <View style={[styles.card, shadows.card]}>
              <Text style={styles.name}>{u.businessName || u.name || "Distributor"}</Text>
              <Text style={styles.meta}>{u.email || u.phone || "—"}</Text>
              {u.distributorRegion ? <Text style={styles.region}>Region: {u.distributorRegion}</Text> : null}
              <Pressable onPress={() => openChat(id)} disabled={busyRow} style={[styles.btn, busyRow && { opacity: 0.6 }]}>
                <Text style={styles.btnTxt}>{busyRow ? "Opening…" : "Open chat"}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { paddingHorizontal: 16, paddingTop: 12, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  card: { padding: 14, marginBottom: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 16, fontWeight: "800", color: colors.header },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  region: { marginTop: 4, fontSize: 12, color: colors.text, fontWeight: "600" },
  btn: { marginTop: 12, alignSelf: "flex-start", backgroundColor: colors.secondaryBlue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnTxt: { color: colors.white, fontWeight: "800" },
  empty: { textAlign: "center", marginTop: 32, color: colors.textSecondary },
});
