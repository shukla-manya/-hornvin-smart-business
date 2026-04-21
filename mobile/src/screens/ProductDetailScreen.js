import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { productsApi, chatApi, ordersApi, wishlistApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors, shadows } from "../theme";

const GALLERY_H = 220;

export function ProductDetailScreen({ route, navigation }) {
  const { productId, orderChannel = "marketplace" } = route.params || {};
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await productsApi.get(productId);
        setProduct(data.product);
      } catch {
        setProduct(null);
      }
    })();
  }, [productId]);

  useEffect(() => {
    if (!isAuthenticated || !productId) {
      setInWishlist(false);
      return;
    }
    (async () => {
      try {
        const { data } = await wishlistApi.status(productId);
        setInWishlist(!!data.inWishlist);
      } catch {
        setInWishlist(false);
      }
    })();
  }, [isAuthenticated, productId]);

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading or not found…</Text>
        <FooterCredit />
      </View>
    );
  }

  const seller = product.sellerId || product.companyId;
  const sellerId = typeof seller === "object" ? seller?._id : seller;

  const images = Array.isArray(product.images) ? product.images.filter((u) => typeof u === "string" && u.trim()) : [];

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      Alert.alert("Login required", "Sign in to save items to your wishlist.");
      return;
    }
    setWishBusy(true);
    try {
      if (inWishlist) {
        await wishlistApi.remove(product._id);
        setInWishlist(false);
      } else {
        await wishlistApi.add(product._id);
        setInWishlist(true);
      }
    } catch (e) {
      Alert.alert("Wishlist", e.response?.data?.error || e.message);
    } finally {
      setWishBusy(false);
    }
  };

  const startChat = async () => {
    if (!isAuthenticated) {
      Alert.alert("Login required", "Sign in to message the seller.");
      return;
    }
    try {
      const { data } = await chatApi.openRoom(sellerId);
      navigation.navigate("ChatRoom", { room: data.room });
    } catch (e) {
      Alert.alert("Chat", e.response?.data?.error || e.message);
    }
  };

  const placeOrder = async () => {
    if (!isAuthenticated) {
      Alert.alert("Login required", "Sign in to place an order.");
      return;
    }
    const q = Number(qty);
    if (!Number.isFinite(q) || q < 1) {
      Alert.alert("Quantity", "Enter a valid quantity.");
      return;
    }
    setBusy(true);
    try {
      await ordersApi.create({
        sellerId,
        items: [{ productId: product._id, quantity: q }],
        orderChannel,
      });
      Alert.alert("Order placed", "Your order is pending confirmation.", [
        { text: "OK", onPress: () => navigation.navigate("Main", { screen: "OrdersTab" }) },
      ]);
    } catch (e) {
      Alert.alert("Order failed", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const pageW = Dimensions.get("window").width;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      {images.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={[styles.slide, { width: pageW }]}>
              <Image source={{ uri }} style={[styles.galleryImg, { width: pageW }]} resizeMode="cover" />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.summary, shadows.card]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{product.name}</Text>
          <Pressable onPress={toggleWishlist} disabled={wishBusy} style={[styles.heartBtn, wishBusy && { opacity: 0.5 }]}>
            <Text style={styles.heartText}>{inWishlist ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
        <Text style={styles.meta}>
          {product.category} · ₹{product.price} · Stock {product.quantity}
        </Text>
        {seller?.businessName || seller?.name ? (
          <Text style={styles.seller}>Sold by {seller.businessName || seller.name}</Text>
        ) : null}
        <Text style={styles.body}>{product.description || "No description provided."}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Quantity</Text>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={styles.qty} />
      </View>

      <Pressable onPress={placeOrder} disabled={busy} style={[styles.cta, busy && { opacity: 0.55 }]}>
        <Text style={styles.ctaText}>{orderChannel === "stock" ? "Buy stock" : "Place order"}</Text>
      </Pressable>
      <Pressable onPress={startChat} style={styles.secondary}>
        <Text style={styles.secondaryText}>Message seller (inquiry)</Text>
      </Pressable>

      {user?.role === "end_user" ? (
        <Text style={styles.hint}>
          Opens a chat thread with the seller so you can ask questions before buying. Use Dealer map on Home to find nearby
          distributors and garages.
        </Text>
      ) : null}
      {user?.role === "retail" || user?.role === "distributor" || user?.role === "company" ? (
        <Text style={styles.hint}>
          {orderChannel === "stock"
            ? "Stock-channel order: replenishment from your linked Hornvin company catalog (supply chain upstream)."
            : "Marketplace order: buy from the listing seller; confirm delivery in Orders and invoice if needed."}{" "}
          Chat keeps quotes and logistics with the same counterparty.
        </Text>
      ) : null}
      <FooterCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  galleryScroll: { marginBottom: 12, marginHorizontal: -16 },
  slide: { height: GALLERY_H },
  galleryImg: { height: GALLERY_H, borderRadius: 16, backgroundColor: colors.border },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.text },
  heartBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  heartText: { fontSize: 22, color: colors.cta },
  meta: { color: colors.textSecondary, marginTop: 6 },
  seller: { color: colors.secondaryBlue, marginTop: 10, fontWeight: "700" },
  body: { color: colors.text, marginTop: 14, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 12 },
  label: { color: colors.textSecondary, width: 80, fontWeight: "600" },
  qty: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  cta: { marginTop: 16, backgroundColor: colors.cta, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ctaText: { color: colors.white, fontWeight: "800" },
  secondary: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: colors.secondaryBlue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  secondaryText: { color: colors.secondaryBlue, fontWeight: "800" },
  hint: { marginTop: 16, color: colors.textSecondary, fontSize: 13 },
  muted: { color: colors.textSecondary },
});
