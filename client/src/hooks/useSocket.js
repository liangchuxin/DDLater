import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL;

// 全局单例 socket 实例。多个组件同时用 useSocket 只会共享同一连接。
let sharedSocket = null;

export function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(API, {
      withCredentials: true, // 带上 cookie，后端靠 session 认用户
      autoConnect: true,
    });
  }
  return sharedSocket;
}

// 订阅某个 study room 的实时事件。
// onEvent 每次有新 room-event 广播时触发。
// onPresence 收到 online 列表更新时触发。
// onSessionStart / onSessionEnd 可选，收到 session 计时事件时触发。
// 进组件时 socket.emit('join-room', roomUid)、退出时 leave-room。
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

// 订阅一个任意名称的 socket 事件（用于个人通知类，比如 join-rejected）。
// enabled=false 时不订阅，方便条件开关。
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
