import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL;

// Shared singleton socket. Multiple components using useSocket reuse the same connection.
let sharedSocket = null;

export function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(API, {
      withCredentials: true, // send cookies; backend authenticates via session
      autoConnect: true,
    });
  }
  return sharedSocket;
}

// Subscribe to a study room's live events.
// onEvent fires on every room-event broadcast.
// onPresence fires on online list updates.
// onSessionStart / onSessionEnd are optional; fire on session timer events.
// On mount: socket.emit('join-room', roomUid). On unmount: leave-room.
export function useRoomSocket(
  roomUid,
  onEvent,
  onPresence,
  onSessionStart,
  onSessionEnd,
) {
  const eventRef = useRef(onEvent);
  const presenceRef = useRef(onPresence);
  const sessionStartRef = useRef(onSessionStart);
  const sessionEndRef = useRef(onSessionEnd);
  useEffect(() => {
    eventRef.current = onEvent;
    presenceRef.current = onPresence;
    sessionStartRef.current = onSessionStart;
    sessionEndRef.current = onSessionEnd;
  }, [onEvent, onPresence, onSessionStart, onSessionEnd]);

  useEffect(() => {
    if (!roomUid) return;
    const socket = getSocket();

    const eventListener = (event) => eventRef.current?.(event);
    const presenceListener = (data) => presenceRef.current?.(data);
    const sessionStartListener = (data) => sessionStartRef.current?.(data);
    const sessionEndListener = () => sessionEndRef.current?.();
    socket.on("room-event", eventListener);
    socket.on("presence", presenceListener);
    socket.on("session-start", sessionStartListener);
    socket.on("session-end", sessionEndListener);

    const doJoin = () => socket.emit("join-room", roomUid);
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);

    return () => {
      socket.emit("leave-room", roomUid);
      socket.off("room-event", eventListener);
      socket.off("presence", presenceListener);
      socket.off("session-start", sessionStartListener);
      socket.off("session-end", sessionEndListener);
      socket.off("connect", doJoin);
    };
  }, [roomUid]);
}

// Subscribe to an arbitrary socket event (useful for personal notifications like join-rejected).
// enabled=false skips subscribing, handy for conditional wiring.
export function useSocketEvent(eventName, handler, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !eventName) return;
    const socket = getSocket();
    const listener = (data) => handlerRef.current?.(data);
    socket.on(eventName, listener);
    return () => socket.off(eventName, listener);
  }, [eventName, enabled]);
}
