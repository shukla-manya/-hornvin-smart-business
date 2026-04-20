import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { wishlistApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { colors, shadows } from "../theme";

export function WishlistScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data } = await wishlistApi.list();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(it) => String(it._id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.muted}>No saved products yet. Open a listing and tap Save to wishlist.</Text>
        }
        ListFooterComponent={<FooterCredit />}
        contentContainerStyle={items.length === 0 ? { padding: 16, flexGrow: 1 } : { padding: 16, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const p = item.productId;
          if (!p || !p._id) {
            return (
              <View style={[styles.card, shadows.card]}>
                <Text style={styles.muted}>Product no longer available</Text>
              </View>
            );
          }
          return (
            <Pressable
              style={[styles.card, shadows.card]}
              onPress={() => navigation.navigate("ProductDetail", { productId: p._id })}
            >
              <Text style={styles.title}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.category} · ₹{p.price}
              </Text>
            </Pressable>
          );
        }}
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
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  meta: { marginTop: 6, color: colors.textSecondary },
  muted: { color: colors.textSecondary, fontSize: 14 },
});
