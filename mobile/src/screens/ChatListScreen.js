import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { authApi, chatApi } from "../api/resources";
import { getSocket } from "../services/socket";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows, radii } from "../theme";
import { useAuth } from "../context/AuthContext";

function peerName(room, myId) {
  const others = (room.participants || []).filter((p) => (p._id || p.id) !== myId);
  const p = others[0];
  return p?.businessName || p?.name || "Chat";
}

function peerRoleLabel(room, myId) {
  const others = (room.participants || []).filter((p) => (p._id || p.id) !== myId);
  const r = others[0]?.role;
  if (r === "distributor") return "Distributor";
  if (r === "retail") return "Garage";
  if (r === "end_user") return "Customer";
  if (r === "company") return "Hornvin company";
  return r ? String(r).replace("_", " ") : "";
}

const SUPPLY_ROLES = new Set(["company", "distributor", "retail"]);

export function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: meData }, { data }] = await Promise.all([authApi.me(), chatApi.rooms()]);
      setMe(meData.user);
      setRooms(data.rooms || []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  useEffect(() => {
    let socket;
    let handler;
    (async () => {
      const s = await getSocket();
      if (!s) return;
      socket = s;
      handler = (payload) => {
        if (!payload?.roomId) return;
        setRooms((prev) => {
          const idx = prev.findIndex((r) => r._id === payload.roomId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            lastPreview: payload.lastPreview ?? next[idx].lastPreview,
            lastMessageAt: payload.lastMessageAt ?? next[idx].lastMessageAt,
          };
          return [...next].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
        });
      };
      s.on("chat:room:updated", handler);
    })();
    return () => {
      if (socket && handler) socket.off("chat:room:updated", handler);
    };
  }, []);

  return (
    <View style={styles.root}>
      <FlatList
        data={rooms}
        keyExtractor={(r) => r._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondaryBlue} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          user?.role && SUPPLY_ROLES.has(user.role) ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Supply chain chat</Text>
              <Text style={styles.bannerText}>
                Garage ↔ distributor quotes, garage ↔ customer updates — pair threads with Marketplace and Orders.
              </Text>
            </View>
          ) : user?.role === "end_user" ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Seller messages</Text>
              <Text style={styles.bannerText}>Message garages or distributors (customer ↔ seller) around parts and service.</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : "No conversations yet."}</Text>}
        renderItem={({ item }) => {
          const roleLbl = peerRoleLabel(item, me?.id);
          return (
          <Pressable
            onPress={() => navigation.getParent()?.getParent()?.navigate("ChatRoom", { room: item })}
            style={[styles.card, shadows.card]}
          >
            <Text style={styles.title}>{peerName(item, me?.id)}</Text>
            {roleLbl ? <Text style={styles.roleTag}>{roleLbl}</Text> : null}
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastPreview || "Open chat"}
            </Text>
          </Pressable>
          );
        }}
        ListFooterComponent={<FooterCredit />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  title: { color: colors.header, fontWeight: "800", fontSize: 16 },
  roleTag: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.secondaryBlue },
  preview: { color: colors.textSecondary, marginTop: 6 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
  banner: {
    backgroundColor: "#E9EEF4",
    borderRadius: radii.card,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#B9C5D4",
  },
  bannerTitle: { fontWeight: "800", color: colors.header, fontSize: 14, marginBottom: 6 },
  bannerText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
