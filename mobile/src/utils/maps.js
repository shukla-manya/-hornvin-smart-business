import { Linking, Platform } from "react-native";

/**
 * Opens Apple Maps (iOS) or Google Maps (Android) driving directions when origin is known;
 * otherwise opens maps at the destination only.
 */
export function openDrivingDirections({ originLat, originLng, destLat, destLng }) {
  const dlat = Number(destLat);
  const dlng = Number(destLng);
  if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) return Promise.resolve(false);

  const olat = Number(originLat);
  const olng = Number(originLng);
  const hasOrigin = Number.isFinite(olat) && Number.isFinite(olng);

  let url;
  if (hasOrigin) {
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?saddr=${olat},${olng}&daddr=${dlat},${dlng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&origin=${olat},${olng}&destination=${dlat},${dlng}&travelmode=driving`;
    }
  } else if (Platform.OS === "ios") {
    url = `http://maps.apple.com/?daddr=${dlat},${dlng}`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${dlat},${dlng}`;
  }

  return Linking.canOpenURL(url).then((ok) => (ok ? Linking.openURL(url) : Linking.openURL(`https://maps.google.com/?q=${dlat},${dlng}`)));
}

export function formatDistanceMeters(m) {
  if (m == null || !Number.isFinite(Number(m))) return "";
  const n = Number(m);
  if (n >= 1000) return `${(n / 1000).toFixed(1)} km`;
  return `${Math.round(n)} m`;
}
