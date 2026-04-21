import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform, FlatList, Dimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { dealerLocatorApi, authApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { colors, shadows } from "../theme";
import { formatDistanceMeters, openDrivingDirections } from "../utils/maps";

const { height: SCREEN_H } = Dimensions.get("window");
const MAP_HEIGHT = Math.round(SCREEN_H * 0.48);

const ROLE_OPTIONS = [
  { id: "distributor", label: "Distributors" },
  { id: "retail", label: "Retail / garages" },
];

export function DealerMapScreen() {
  const { user } = useAuth();
  const [dealerRole, setDealerRole] = useState("distributor");
  const [region, setRegion] = useState({
    latitude: 28.6139,
    longitude: 77.209,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  });
  const [userPos, setUserPos] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);

  const locate = async (roleOverride) => {
    const role = roleOverride ?? dealerRole;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location", "Permission is required to find nearby dealers.");
      return;
    }
    setLoading(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserPos({ lat, lng });
      setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 });
      const { data } = await dealerLocatorApi.nearby({ lat, lng, role });
      setDealers(data.dealers || []);
      try {
        await authApi.patchMeLocation({ lat, lng });
      } catch {
        /* optional */
      }
    } catch (e) {
      Alert.alert("Dealers", e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    locate("distributor");
  }, []);

  const directionsTo = (dealer) => {
    const coords = dealer.location?.coordinates;
    if (!coords || coords.length < 2) {
      Alert.alert("Directions", "This dealer has no map coordinates on file.");
      return;
    }
    const [dlng, dlat] = coords;
    openDrivingDirections({
      originLat: userPos?.lat,
      originLng: userPos?.lng,
      destLat: dlat,
      destLng: dlng,
    }).catch(() => Alert.alert("Directions", "Could not open maps."));
  };

  const renderDealer = ({ item: d }) => {
    const coords = d.location?.coordinates;
    const [dlng, dlat] = coords?.length >= 2 ? coords : [null, null];
    const dist = formatDistanceMeters(d.distanceMeters);
    const title = d.businessName || d.name || "Dealer";
    return (
      <View style={[styles.rowCard, shadows.card]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dealerTitle}>{title}</Text>
          {dist ? <Text style={styles.dealerMeta}>{dist} away</Text> : null}
          {d.phone ? <Text style={styles.dealerMeta}>{d.phone}</Text> : null}
          {d.email ? <Text style={styles.dealerMeta}>{d.email}</Text> : null}
        </View>
        <Pressable onPress={() => directionsTo(d)} style={styles.dirBtn}>
          <Text style={styles.dirBtnText}>Directions</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {user?.role && user.role !== "end_user" ? (
        <Text style={styles.supplyHint}>
          Supply chain geography: locate distributor branches and garage partners for pickups, stock transfers, and field
          service.
        </Text>
      ) : null}
      <View style={{ height: MAP_HEIGHT }}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          region={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation={Boolean(userPos)}
          showsMyLocationButton={false}
        >
          {userPos ? (
            <Marker coordinate={{ latitude: userPos.lat, longitude: userPos.lng }} title="You" pinColor={colors.cta} />
          ) : null}
          {dealers.map((d) => {
            const coords = d.location?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lng, lat] = coords;
            return (
              <Marker
                key={d._id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={d.businessName || d.name || "Dealer"}
                description={formatDistanceMeters(d.distanceMeters) || d.phone || ""}
                pinColor={colors.header}
              />
            );
          })}
        </MapView>
      </View>

      <View style={styles.roleRow}>
        {ROLE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => {
              setDealerRole(opt.id);
              locate(opt.id);
            }}
            style={[styles.roleChip, dealerRole === opt.id && styles.roleChipOn]}
          >
            <Text style={[styles.roleChipTxt, dealerRole === opt.id && styles.roleChipTxtOn]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          Nearby {dealerRole === "retail" ? "shops & garages" : "distributors"}
        </Text>
        <Text style={styles.listSub}>{loading ? "Updating…" : `${dealers.length} on map`}</Text>
        <Pressable onPress={() => locate()} style={styles.refresh}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <FlatList
        data={dealers}
        keyExtractor={(d) => d._id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? "Loading…" : "No dealers with saved locations in this area."}</Text>
        }
        renderItem={renderDealer}
        ListFooterComponent={<FooterCredit />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  supplyHint: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleChipOn: { borderColor: colors.selectionBorder, backgroundColor: colors.selectionBg },
  roleChipTxt: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  roleChipTxtOn: { color: colors.header },
  listHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  listTitle: { color: colors.header, fontWeight: "800", fontSize: 17 },
  listSub: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  refresh: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colors.secondaryBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshText: { color: colors.white, fontWeight: "800" },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dealerTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  dealerMeta: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  dirBtn: { backgroundColor: colors.cta, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  dirBtnText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 20, paddingHorizontal: 16 },
});
