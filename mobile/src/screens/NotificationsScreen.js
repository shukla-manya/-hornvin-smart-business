import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform, ScrollView } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "../services/api";
import { notificationsFeedApi, chatApi } from "../api/resources";
import { useAuth } from "../context/AuthContext";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isEndUser = user?.role === "end_user";
  const [pushStatus, setPushStatus] = useState(null);
  const [feedRows, setFeedRows] = useState([]);
  const [feedMeta, setFeedMeta] = useState(null);
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, f, d] = await Promise.all([
        api.get("/notifications/push-status"),
        notificationsFeedApi.list({ limit: 80 }),
        api.get("/notifications/devices"),
      ]);
      setPushStatus(s.data);
      setFeedRows(f.data.notifications || []);
      setFeedMeta(f.data.meta || null);
      setDevices(d.data.devices || []);
    } catch {
      setPushStatus(null);
      setFeedRows([]);
      setFeedMeta(null);
      setDevices([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const registerDeviceToken = async () => {
    setBusy(true);
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Notifications", "Permission is required to register for push.");
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const opts = projectId ? { projectId } : undefined;
      const expoToken = await Notifications.getExpoPushTokenAsync(opts);
      const token = expoToken.data;
      await api.post("/notifications/device-token", {
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      Alert.alert("Registered", "Your device token was saved. Push sending will activate when the backend provider is configured.");
      await load();
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      Alert.alert(
        "Push registration",
        `${msg}\n\nFor Expo push tokens, add "extra": { "eas": { "projectId": "…" } } to app.json (EAS project) or use an EAS build.`
      );
    } finally {
      setBusy(false);
    }
  };

  const openNotification = async (n) => {
    try {
      if (!n.readAt) {
        await notificationsFeedApi.markRead(n.id);
        setFeedRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      }
    } catch {
      /* still try navigation */
    }

    if (n.type === "chat_message" && n.roomId) {
      try {
        const { data } = await chatApi.rooms();
        const room = (data.rooms || []).find((r) => String(r._id) === String(n.roomId));
        if (room) {
          navigation.navigate("ChatRoom", { room });
          return;
        }
      } catch {
        /* fall through */
      }
      Alert.alert(
        "Chat",
        isEndUser ? "From a product, use Message seller — there is no separate Chat tab on your account." : "Open the Chat tab and select this conversation."
      );
      return;
    }

    if ((n.type === "order_new" || n.type === "order_status") && n.orderId) {
      navigation.navigate("Main", { screen: "OrdersTab" });
      return;
    }

    if (n.type === "stock_alert" && n.productId) {
      navigation.navigate("ProductDetail", { productId: n.productId });
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsFeedApi.markAllRead();
      await load();
    } catch (e) {
      Alert.alert("Notifications", e.response?.data?.error || e.message);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.h1}>{isEndUser ? "Reminders" : "Notifications"}</Text>
      <Text style={styles.sub}>
        {isEndUser
          ? "Service visits, payment due dates, and order updates — plus optional push."
          : "In-app feed (orders, chat, low stock) and optional device push."}
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Push status (server)</Text>
        <Text style={styles.mono}>{pushStatus ? JSON.stringify(pushStatus, null, 2) : "—"}</Text>
        <Pressable onPress={registerDeviceToken} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
          <Text style={styles.ctaText}>Register this device for push</Text>
        </Pressable>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>Saved device rows</Text>
        {devices.length ? (
          devices.map((d) => (
            <Text key={d._id} style={styles.row}>
              {d.platform} · {new Date(d.updatedAt || d.createdAt).toLocaleString()}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>No tokens stored yet.</Text>
        )}
      </View>

      <View style={[styles.card, shadows.card]}>
        <View style={styles.feedHeader}>
          <Text style={styles.cardTitle}>In-app feed</Text>
          {feedRows.some((n) => !n.readAt) ? (
            <Pressable onPress={markAllRead}>
              <Text style={styles.link}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>
        {feedMeta ? (
          <Text style={styles.mutedSmall}>
            {feedMeta.source === "in_app" ? `${feedRows.length} item(s)` : ""}
            {typeof feedMeta.unreadCount === "number" ? ` · ${feedMeta.unreadCount} unread` : ""}
          </Text>
        ) : null}
        {feedRows.length === 0 ? (
          <Text style={styles.muted}>
            {isEndUser
              ? "Nothing yet. When your shop or Hornvin sends alerts, they appear here."
              : "No notifications yet. New orders, messages, and low-stock alerts appear here."}
          </Text>
        ) : (
          feedRows.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => openNotification(n)}
              style={[styles.notifRow, !n.readAt && styles.notifUnread]}
            >
              <Text style={styles.notifTitle}>{n.title}</Text>
              {n.body ? <Text style={styles.notifBody}>{n.body}</Text> : null}
              <Text style={styles.notifMeta}>
                {n.type} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.header },
  sub: { marginTop: 6, color: colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  cardTitle: { fontWeight: "800", color: colors.header, marginBottom: 8 },
  feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  link: { color: colors.secondaryBlue, fontWeight: "700", fontSize: 13 },
  mutedSmall: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, color: colors.text },
  muted: { color: colors.textSecondary },
  row: { color: colors.text, marginTop: 4, fontSize: 13 },
  notifRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  notifUnread: { borderColor: colors.secondaryBlue, backgroundColor: "#f0f7ff" },
  notifTitle: { fontWeight: "800", color: colors.text, fontSize: 14 },
  notifBody: { marginTop: 4, color: colors.text, fontSize: 13 },
  notifMeta: { marginTop: 6, fontSize: 11, color: colors.textSecondary },
  cta: {
    marginTop: 12,
    backgroundColor: colors.secondaryBlue,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "800" },
});
