import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSocketBaseUrl } from "./api";

let socket;
let lastAuthToken;

/**
 * Drop the current connection so the next `getSocket()` uses the latest JWT
 * (e.g. after login or token refresh).
 */
export function invalidateSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = undefined;
    lastAuthToken = undefined;
  }
}

export function disconnectSocket() {
  invalidateSocket();
}

/**
 * Authenticated Socket.IO client. Reconnects if the stored token changed.
 * Uses websocket + polling fallback for React Native networks.
 */
export async function getSocket() {
  const token = await AsyncStorage.getItem("vello_token");
  if (!token) return null;

  if (socket?.connected && lastAuthToken === token) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = undefined;
  }

  lastAuthToken = token;
  const base = getSocketBaseUrl();

  socket = io(base, {
    transports: ["websocket", "polling"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1500,
  });

  return socket;
}

export function emitChatTyping(roomId, typing) {
  void (async () => {
    const s = await getSocket();
    if (!s?.connected || !roomId) return;
    s.emit("chat:typing", { roomId: String(roomId), typing: Boolean(typing) });
  })();
}
