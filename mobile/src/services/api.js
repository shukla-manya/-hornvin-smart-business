import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Base URL without `/api` — same host as Socket.IO unless EXPO_PUBLIC_SOCKET_URL is set. */
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("vello_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Request failed";
    err.userMessage = typeof msg === "string" ? msg : "Request failed";
    return Promise.reject(err);
  }
);

export function getApiBaseUrl() {
  return API_URL;
}

/** Socket.IO origin (no path). Defaults to API host. */
export function getSocketBaseUrl() {
  const u = process.env.EXPO_PUBLIC_SOCKET_URL || API_URL;
  return u.replace(/\/$/, "");
}
