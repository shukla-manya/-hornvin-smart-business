import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { chatApi } from "../api/resources";
import { FooterCredit } from "../components/FooterCredit";
import { useAuth } from "../context/AuthContext";
import { getSocket, emitChatTyping } from "../services/socket";
import { colors } from "../theme";

export function ChatRoomScreen({ route }) {
  const { room } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const typingIdleRef = useRef(null);
  const typingPeerClearRef = useRef(null);

  const typingPeerLabel = useMemo(() => {
    if (!typingUserId || !room?.participants) return "";
    const peer = room.participants.find((p) => String(p._id || p.id) === String(typingUserId));
    return peer?.businessName || peer?.name || "Someone";
  }, [typingUserId, room?.participants]);

  const load = useCallback(async () => {
    const { data } = await chatApi.messages(room._id);
    setMessages(data.messages || []);
  }, [room._id]);

  useEffect(() => {
    load();
    let mounted = true;
    (async () => {
      const s = await getSocket();
      if (!mounted || !s) return;
      socketRef.current = s;
      s.emit("room:join", room._id);

      const onNew = (payload) => {
        const msg = payload?.message;
        if (!msg) return;
        const msgRoom = msg.roomId ?? msg.room?._id;
        if (msgRoom && String(msgRoom) !== String(room._id)) return;
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      };

      const onTyping = (payload) => {
        if (!payload || String(payload.userId) === String(user?.id)) return;
        if (typingPeerClearRef.current) clearTimeout(typingPeerClearRef.current);
        if (payload.typing) {
          setTypingUserId(String(payload.userId));
          typingPeerClearRef.current = setTimeout(() => setTypingUserId(null), 2800);
        } else {
          setTypingUserId(null);
        }
      };

      s.on("message:new", onNew);
      s.on("chat:typing", onTyping);
      s.__velloOnNew = onNew;
      s.__velloOnTyping = onTyping;
    })();

    return () => {
      mounted = false;
      emitChatTyping(room._id, false);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (typingPeerClearRef.current) clearTimeout(typingPeerClearRef.current);
      const s = socketRef.current;
      if (s) {
        if (s.__velloOnNew) s.off("message:new", s.__velloOnNew);
        if (s.__velloOnTyping) s.off("chat:typing", s.__velloOnTyping);
      }
    };
  }, [load, room._id, user?.id]);

  const flushTypingIdle = () => {
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => emitChatTyping(room._id, false), 1400);
  };

  const onChangeComposer = (v) => {
    setText(v);
    const active = v.trim().length > 0;
    emitChatTyping(room._id, active);
    flushTypingIdle();
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    emitChatTyping(room._id, false);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    const { data } = await chatApi.sendMessage(room._id, { body });
    setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <FlatList
        style={{ flex: 1 }}
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m._id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12, paddingBottom: 12, backgroundColor: colors.background }}
        renderItem={({ item }) => {
          const mine = (item.senderId?._id || item.senderId) === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
            </View>
          );
        }}
        ListFooterComponent={<FooterCredit compact />}
      />
      {typingUserId ? (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingPeerLabel} is typing…</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={onChangeComposer}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={styles.send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16, marginBottom: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.chatSender },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.chatReceiver,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: colors.text },
  typingBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  typingText: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.card,
  },
  send: { backgroundColor: colors.secondaryBlue, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  sendText: { color: colors.white, fontWeight: "800" },
});
