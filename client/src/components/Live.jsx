import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import PixelBox from "./PixelBox";
import RoomScene from "./live/RoomScene";
import SeatInviteBanner from "./live/SeatInviteBanner";
import SceneToolbar from "./live/SceneToolbar";
import { Avatar, SelfPanel, MemberPanel, OverallPanel } from "./live/Panels";
import {
  CANVAS_REF_H,
  WORLD_SCALE,
  SIDE_MIN_FROM_CENTER,
  BG_SRC,
  BG_HEIGHT_PCT,
  BG_OFFSET_X_REF,
  BG_OFFSET_Y_REF,
} from "./live/roomConfig";
import {
  getDominantColor,
  buildLayoutFromRoom,
  sideCenterX,
  applySeatFurnitureChange,
} from "./live/liveUtils";
import { normalizeDeskLayout, getDeskSeat } from "./live/furniture/normalizeDeskLayout";
import { useRoomSocket, useSocketEvent } from "../hooks/useSocket";
import PushOutLoader from "./PushOutLoader";
import { useConfirm } from "./ConfirmModal";
import "../styles/Live.css";

const API = import.meta.env.VITE_API_URL;

const SWAP_EPHEMERAL_EVENTS = new Set([
  "seat_swap_request",
  "seat_swap_declined",
  "seat_swap_expired",
  "seat_swap_accepted",
  "seat_change",
]);

export default function Live() {
  const { uid: roomUid } = useParams();
  const navigate = useNavigate();

  // Selection
  const [selected, setSelected] = useState("self");
  const [sceneTargetUserId, setSceneTargetUserId] = useState(null);
  const [scenePendingUserId, setScenePendingUserId] = useState(null);
  const [incomingSeatInvite, setIncomingSeatInvite] = useState(null);
  const [changingFurniture, setChangingFurniture] = useState(false);

  // Current auth user
  const [self, setSelf] = useState(null);
  const [selfProfile, setSelfProfile] = useState(null);
  const [selfTasks, setSelfTasks] = useState([]);

  // Confirm dialog
  const { confirm, modal: confirmModal } = useConfirm();

  // Room data
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [events, setEvents] = useState([]);

  // Presence & session
  const [onlineUserIds, setOnlineUserIds] = useState([]); // array of user _id strings
  const [sessionStartAt, setSessionStartAt] = useState(null); // ISO string or null
  const [now, setNow] = useState(Date.now()); // tick each second to drive session timer

  // Badge color
  const [badgeColor, setBadgeColor] = useState("var(--green)");
  const [badgeShadow, setBadgeShadow] = useState("rgba(45,138,62,0.2)");

  // Scene data
  const [furnitures, setFurnitures] = useState([]);
  const [ownedFurnitureKeys, setOwnedFurnitureKeys] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const sceneRef = useRef(null);
  const seatMigrateRef = useRef(false);

  // Camera
  const [cameraX, setCameraX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startCameraX: 0,
    moved: false,
  });

  // Fetch: global data
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then(setSelf);
    fetch(`${API}/api/profile`, { credentials: "include" })
      .then((r) => r.json())
      .then(setSelfProfile);
    fetch(`${API}/api/tasks`, { credentials: "include" })
      .then((r) => r.json())
      .then(setSelfTasks);
    fetch(`${API}/api/furnitures`, { credentials: "include" })
      .then((r) => r.json())
      .then(setFurnitures)
      .catch(() => setFurnitures([]));
    fetch(`${API}/api/me/furniture`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOwnedFurnitureKeys(data.keys ?? []))
      .catch(() => setOwnedFurnitureKeys([]));
  }, []);

  const refetchFurnitures = useCallback(async () => {
    const r = await fetch(`${API}/api/furnitures`, { credentials: "include" });
    if (r.ok) setFurnitures(await r.json());
  }, []);

  const refetchRoom = useCallback(async () => {
    const r = await fetch(`${API}/api/rooms/${roomUid}`, {
      credentials: "include",
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    return r.json();
  }, [roomUid]);

  const refetchEvents = useCallback(async () => {
    const r = await fetch(`${API}/api/rooms/${roomUid}/events?limit=50`, {
      credentials: "include",
    });
    if (r.ok) {
      const data = await r.json();
      setEvents(data.filter((ev) => ev.type !== "seat_change"));
    }
  }, [roomUid]);

  useEffect(() => {
    seatMigrateRef.current = false;
    setRoom(null);
    setRoomError(null);
    setEvents([]);
    refetchRoom()
      .then((r) => {
        setRoom(r);
        setSessionStartAt(r.sessionStartAt);
      })
      .catch((e) => setRoomError(e.message));
    refetchEvents().catch(() => {});
  }, [roomUid, refetchRoom, refetchEvents]);

  // Legacy rooms may load before seats are migrated; one refetch after GET ensure.
  useEffect(() => {
    if (!room?.members?.length || !self || seatMigrateRef.current) return;
    const missingSeat = room.members.some(
      (m) => !m.seat?.placement || !m.seat?.furnitureKey,
    );
    if (!missingSeat) return;
    seatMigrateRef.current = true;
    refetchRoom()
      .then(setRoom)
      .catch(() => {});
  }, [room, self, refetchRoom]);

  // Session timer: tick each second. Null sessionStartAt means no active session.
  useEffect(() => {
    if (!sessionStartAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionStartAt]);

  // Derived: admin (= owner) check
  const isAdmin = useMemo(() => {
    if (!room || !self) return false;
    return String(room.owner?._id ?? room.owner) === String(self._id);
  }, [room, self]);

  // Socket: subscribe to room events.
  // On incoming event:
  //   1. Prepend to events list so history UI updates immediately
  //   2. If the event changes member/task state, refetch room
  const handleRoomEvent = useCallback(
    (event) => {
      if (SWAP_EPHEMERAL_EVENTS.has(event.type)) {
        if (
          event.type === "seat_swap_request" &&
          self &&
          String(event.payload?.targetUserId) === String(self._id)
        ) {
          setIncomingSeatInvite({
            fromUserId: event.actor?._id,
            fromName: event.actor?.displayName ?? "Someone",
          });
        }

        if (
          (event.type === "seat_swap_declined" ||
            event.type === "seat_swap_expired") &&
          self &&
          String(event.payload?.requesterUserId) === String(self._id)
        ) {
          setScenePendingUserId(null);
          setSceneTargetUserId(null);
        }

        if (
          event.type === "seat_swap_expired" &&
          self &&
          String(event.payload?.inviteeUserId) === String(self._id)
        ) {
          setIncomingSeatInvite(null);
        }

        if (event.type === "seat_swap_accepted") {
          setScenePendingUserId(null);
          setSceneTargetUserId(null);
          setIncomingSeatInvite(null);
          refetchRoom()
            .then(setRoom)
            .catch(() => {});
        }

        if (event.type === "seat_change") {
          const actorId = event.actor?._id;
          const { furnitureKey, centerSync } = event.payload ?? {};
          if (actorId && furnitureKey) {
            setRoom((prev) =>
              prev
                ? applySeatFurnitureChange(prev, actorId, furnitureKey, centerSync)
                : prev,
            );
          }
        }

        return;
      }

      // Admin-only events are broadcast to everyone; filter client-side.
      const adminOnly = [
        "join_request",
        "join_approved",
        "join_rejected",
      ].includes(event.type);
      if (adminOnly && !isAdmin) return;

      setEvents((prev) => [event, ...prev]);

      // Events that affect member list / tasks → refetch
      const needsRefetch = [
        "member_joined",
        "leave",
        "member_kicked",
        "task_add",
        "task_remove",
        "task_complete",
        "task_progress",
        "join_request", // pendingMembers changed
        "join_rejected", // pendingMembers changed; without refetch other admins' buttons won't disappear
      ].includes(event.type);
      if (needsRefetch)
        refetchRoom()
          .then(setRoom)
          .catch(() => {});
    },
    [isAdmin, refetchRoom, self],
  );
  const handlePresence = useCallback(({ online }) => {
    setOnlineUserIds(online ?? []);
  }, []);
  const handleSessionStart = useCallback(({ sessionStartAt }) => {
    setSessionStartAt(sessionStartAt);
  }, []);
  const handleSessionEnd = useCallback(() => {
    setSessionStartAt(null);
  }, []);
  useRoomSocket(
    roomUid,
    handleRoomEvent,
    handlePresence,
    handleSessionStart,
    handleSessionEnd,
  );

  // Admin approve / reject
  const onApprove = async (userId) => {
    const r = await fetch(`${API}/api/rooms/${room._id}/approve/${userId}`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      // Socket broadcast will refresh too, but a manual refetch reduces latency.
      const fresh = await refetchRoom();
      setRoom(fresh);
      await refetchEvents();
    }
  };
  const onReject = async (userId) => {
    const r = await fetch(`${API}/api/rooms/${room._id}/reject/${userId}`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      // Refetch to sync pendingMembers, otherwise the button won't disappear.
      const fresh = await refetchRoom();
      setRoom(fresh);
      await refetchEvents();
    }
  };

  // Owner kick member.
  // Socket broadcast triggers a refetch, but do one manually to cut perceived latency.
  // If the currently selected member is the one kicked, reset selection to self.
  const onKick = async (userId) => {
    const kickedMember = members.find(
      (m) => String(m.userId) === String(userId),
    );
    const r = await fetch(`${API}/api/rooms/${room._id}/kick/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      const fresh = await refetchRoom();
      setRoom(fresh);
      if (kickedMember && selected === kickedMember.uid) {
        setSelected("self");
      }
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "Failed to remove user.");
    }
  };

  // I was kicked by someone else.
  // Personal 'kicked-from-room' channel, emitted server-side at kick time.
  // Leave immediately; otherwise the next refetch would see us as non-member.
  useSocketEvent(
    "kicked-from-room",
    (data) => {
      alert(`You were removed from ${data?.roomName || "this room"}.`);
      navigate("/rooms");
    },
    true,
  );

  // Derived: Set of pendingMembers user ids.
  // HistoryList uses this to decide whether to show approve/reject buttons.
  const pendingUserIds = useMemo(() => {
    if (!room?.pendingMembers) return new Set();
    return new Set(room.pendingMembers.map((u) => String(u._id ?? u)));
  }, [room]);

  // Derived: members + roomTasks.
  // members = everyone in the scene except self (rendered as characters)
  // roomTasks = my own tasks in this room
  // room.members includes self; the local "members" variable excludes self.
  // A trimmed room (gate state for non-members) has no members field, so return early.
  const { members, roomTasks } = useMemo(() => {
    if (!room || !self || !Array.isArray(room.members))
      return { members: [], roomTasks: [] };
    let myTasks = [];
    const others = [];
    room.members.forEach((m) => {
      const userId = m.user?._id ?? m.user;
      const isMe = String(userId) === String(self._id);
      if (isMe) {
        myTasks = m.tasks ?? [];
        return;
      }
      if (m.profile) {
        others.push({
          ...m.profile,
          // Keep User._id explicitly (used for presence). profile._id is NOT User._id.
          userId: String(userId),
          tasks: m.tasks ?? [],
        });
      }
    });
    return { members: others, roomTasks: myTasks };
  }, [room, self]);

  const selfSeat = useMemo(() => {
    if (!room?.members || !self) return null;
    const me = room.members.find(
      (m) => String(m.user?._id ?? m.user) === String(self._id),
    );
    return me?.seat ?? null;
  }, [room, self]);

  // Background setup.
  // room.background stores filename + offsets; use fallback if room not ready or legacy doc.
  const bg = useMemo(() => {
    const b = room?.background;
    if (!b) {
      return {
        src: BG_SRC,
        heightPct: BG_HEIGHT_PCT,
        offsetX: BG_OFFSET_X_REF,
        offsetY: BG_OFFSET_Y_REF,
      };
    }
    return {
      src: `/room/backgrounds/${b.key}`,
      heightPct: b.heightPct,
      offsetX: b.offsetX,
      offsetY: b.offsetY,
    };
  }, [room]);

  // Natural bg size for camera clamp
  const [bgNaturalSize, setBgNaturalSize] = useState({ w: 1568, h: 896 });
  useEffect(() => {
    const img = new Image();
    img.onload = () =>
      setBgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = bg.src;
  }, [bg.src]);

  // Camera bounds
  const cameraBounds = (() => {
    if (!canvasSize.w || !canvasSize.h) return { min: 0, max: 0 };
    const k = canvasSize.h / CANVAS_REF_H;
    const bgAspect = bgNaturalSize.w / bgNaturalSize.h;
    const bgRenderW = canvasSize.h * (bg.heightPct / 100) * bgAspect;
    const bgOffX = bg.offsetX * k;
    const worldBound = (canvasSize.w * (WORLD_SCALE - 1)) / 2;
    const bgBoundHalf = (bgRenderW - canvasSize.w) / 2;
    const upper = Math.min(worldBound, bgBoundHalf - bgOffX);
    const lower = Math.max(-worldBound, -bgBoundHalf - bgOffX);
    if (upper < lower) return { min: -bgOffX, max: -bgOffX };
    return { min: lower, max: upper };
  })();
  const clampCamera = (v) =>
    Math.max(cameraBounds.min, Math.min(cameraBounds.max, v));

  useEffect(() => {
    setCameraX((v) =>
      Math.max(cameraBounds.min, Math.min(cameraBounds.max, v)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraBounds.min, cameraBounds.max]);

  // Badge color
  const badgeSrc =
    selected === "overall" || selected === "self"
      ? (self?.avatar ?? null)
      : (members.find((m) => m.uid === selected)?.avatar ?? null);

  useEffect(() => {
    if (!badgeSrc) {
      setBadgeColor("var(--green)");
      setBadgeShadow("rgba(45,138,62,0.2)");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const color = getDominantColor(img);
        setBadgeColor(color);
        const m = color.match(/\d+/g);
        if (m) setBadgeShadow(`rgba(${m[0]},${m[1]},${m[2]},0.35)`);
      } catch (e) {}
    };
    img.src = badgeSrc;
  }, [badgeSrc]);

  // Canvas size.
  // Deps include self and room because the JSX (and sceneRef) only mount once both are ready.
  useLayoutEffect(() => {
    if (!sceneRef.current) return;
    const target = sceneRef.current.parentElement;
    if (!target) return;
    const { width, height } = target.getBoundingClientRect();
    if (height > 0) setCanvasSize({ w: width, h: height });
  }, [self, room]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const target = sceneRef.current.parentElement;
    if (!target) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    obs.observe(target);
    return () => obs.disconnect();
  }, [self, room]);

  // Keys the current user may pick in the furniture toolbar (owned ∩ room whitelist).
  const allowedFurnitureKeys = useMemo(() => {
    if (!room || ownedFurnitureKeys.length === 0) return [];
    if (room.furnitures?.length > 0) {
      const roomSet = new Set(room.furnitures);
      return ownedFurnitureKeys.filter((key) => roomSet.has(key));
    }
    return ownedFurnitureKeys;
  }, [room, ownedFurnitureKeys]);

  // Keys valid for rendering anyone's seat in the scene (catalog ∩ room whitelist).
  const sceneFurnitureKeys = useMemo(() => {
    if (!room || !furnitures.length) return [];
    if (room.furnitures?.length > 0) {
      const roomSet = new Set(room.furnitures);
      return furnitures
        .filter((f) => roomSet.has(f.key))
        .map((f) => f.key);
    }
    return furnitures.map((f) => f.key);
  }, [room, furnitures]);

  // Tag each member with isOnline so the scene can dim offline avatars.
  const allMembersForScene = useMemo(() => {
    if (!self) return [];
    const onlineSet = new Set(onlineUserIds.map(String));
    const selfOnline = onlineSet.has(String(self._id));
    return [
      {
        ...self,
        isSelf: true,
        activeAvatar: selfProfile?.activeAvatar,
        isOnline: selfOnline,
      },
      ...members.map((m) => ({
        ...m,
        isSelf: false,
        isOnline: onlineSet.has(String(m.userId)),
      })),
    ];
  }, [self, selfProfile, members, onlineUserIds]);

  const layout = useMemo(() => {
    if (!room?.members || !furnitures.length || !self) return [];
    const ownerId = String(room.owner?._id ?? room.owner);
    return buildLayoutFromRoom(
      room.members,
      allMembersForScene,
      furnitures,
      ownerId,
      sceneFurnitureKeys,
    );
  }, [room, furnitures, self, allMembersForScene, sceneFurnitureKeys]);

  // Focus camera on selection change
  useEffect(() => {
    if (!canvasSize.w || !layout.length) return;
    const k = canvasSize.h / CANVAS_REF_H;
    const sideMin = SIDE_MIN_FROM_CENTER * k;

    let targetUserId = null;
    if (selected === "self") targetUserId = String(self._id);
    else if (selected !== "overall") {
      const found = members.find((m) => m.uid === selected);
      if (found) targetUserId = String(found.userId);
    }

    let targetCanvasX = canvasSize.w / 2;
    if (targetUserId) {
      const seat = layout.find((s) => s.userId === targetUserId);
      if (seat) {
        if (seat.position === "center") {
          const deskLayout = normalizeDeskLayout(
            seat.furniture.layout,
            seat.furniture.capacity ?? 2,
          );
          const halfGap = deskLayout.charHalfGap * k;
          const seatCfg = getDeskSeat(deskLayout, seat.slotIndex);
          targetCanvasX =
            canvasSize.w / 2 +
            (seat.slotIndex === 0 ? -halfGap : halfGap) +
            seatCfg.charOffsetX * k;
        } else {
          const sideInset = seat.furniture.layout.sideInset * k;
          targetCanvasX = sideCenterX(
            seat.position,
            sideInset,
            canvasSize.w,
            sideMin,
          );
        }
      }
    }
    setCameraX(clampCamera(canvasSize.w / 2 - targetCanvasX));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, canvasSize.w, canvasSize.h, layout, members, furnitures, self]);

  const onSceneTargetSelect = useCallback(
    (userId) => {
      setSceneTargetUserId(userId);
      if (!userId) {
        setScenePendingUserId(null);
        return;
      }
      const member = members.find((m) => String(m.userId) === String(userId));
      if (member) setSelected(member.uid);
    },
    [members],
  );

  const onSceneAction = useCallback(
    async (entry, slotId) => {
      if (slotId !== 1 || !room?._id) return;
      setScenePendingUserId(entry.userId);
      try {
        const r = await fetch(`${API}/api/rooms/${room._id}/seat/swap/request`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: entry.userId }),
        });
        if (!r.ok) {
          setScenePendingUserId(null);
          const data = await r.json().catch(() => ({}));
          alert(data.error || "Could not send swap request.");
        }
      } catch {
        setScenePendingUserId(null);
        alert("Could not send swap request.");
      }
    },
    [room],
  );

  const onScenePendingTimeout = useCallback(() => {
    setScenePendingUserId(null);
    setSceneTargetUserId(null);
  }, []);

  const onSeatInviteAccept = useCallback(async () => {
    if (!incomingSeatInvite?.fromUserId || !room?._id) return;
    try {
      const r = await fetch(`${API}/api/rooms/${room._id}/seat/swap/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: incomingSeatInvite.fromUserId }),
      });
      setIncomingSeatInvite(null);
      if (r.ok) {
        const fresh = await refetchRoom();
        setRoom(fresh);
      } else {
        const data = await r.json().catch(() => ({}));
        alert(data.error || "Could not accept swap.");
      }
    } catch {
      setIncomingSeatInvite(null);
      alert("Could not accept swap.");
    }
  }, [incomingSeatInvite, room, refetchRoom]);

  const onSeatInviteDecline = useCallback(async () => {
    if (!incomingSeatInvite?.fromUserId || !room?._id) return;
    try {
      await fetch(`${API}/api/rooms/${room._id}/seat/swap/decline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: incomingSeatInvite.fromUserId }),
      });
    } catch {
      // still dismiss locally
    }
    setIncomingSeatInvite(null);
  }, [incomingSeatInvite, room]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__previewSeatInvite = (fromName = "Mika") => {
      setIncomingSeatInvite({ fromUserId: "preview", fromName });
    };
    return () => {
      delete window.__previewSeatInvite;
    };
  }, []);

  // Drag gesture
  const onScenePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startCameraX: cameraX,
      moved: false,
    };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };
  const onScenePointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    setCameraX(clampCamera(d.startCameraX + dx));
  };
  const onScenePointerUp = (e) => {
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    setIsDragging(false);
    if (!moved) setSceneTargetUserId(null);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const sceneScale =
    canvasSize.h > 0 ? canvasSize.h / CANVAS_REF_H : 1;

  // Panel data
  const allMembers = self
    ? [{ ...self, profile: selfProfile, tasks: roomTasks }, ...members]
    : members;

  const panelMember = members.find((m) => m.uid === selected);
  const selfInitials = self?.displayName?.slice(0, 2).toUpperCase() ?? "...";
  const badgeInitials =
    selected === "self" || selected === "overall"
      ? selfInitials
      : (panelMember?.displayName?.slice(0, 2).toUpperCase() ?? "??");

  // Task add / remove.
  // On success, socket broadcasts task_add/task_remove and handleRoomEvent refetches.
  // We also refetch here for safety (in case self misses its own broadcast).
  const onAddTask = async (task) => {
    const r = await fetch(`${API}/api/rooms/${room._id}/member/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task._id }),
    });
    if (r.ok) {
      const fresh = await refetchRoom();
      setRoom(fresh);
    }
  };
  const onRemoveTask = async (taskId) => {
    const r = await fetch(
      `${API}/api/rooms/${room._id}/member/tasks/${taskId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (r.ok) {
      const fresh = await refetchRoom();
      setRoom(fresh);
    }
  };

  const onFurnitureChange = async (furnitureKey) => {
    if (!room?._id || !self?._id || changingFurniture) return;
    const centerSync =
      furnitures.find((f) => f.key === furnitureKey)?.slotType === "center";
    setChangingFurniture(true);
    const prevRoom = room;
    setRoom((r) =>
      r ? applySeatFurnitureChange(r, self._id, furnitureKey, centerSync) : r,
    );
    try {
      const r = await fetch(`${API}/api/rooms/${room._id}/member/seat`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ furnitureKey }),
      });
      if (!r.ok) {
        setRoom(prevRoom);
        const data = await r.json().catch(() => ({}));
        alert(data.error || "Could not change furniture.");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (data.furnitureKey) {
        setRoom((current) =>
          current
            ? applySeatFurnitureChange(
                current,
                self._id,
                data.furnitureKey,
                data.centerSync,
              )
            : current,
        );
      }
    } catch {
      setRoom(prevRoom);
      alert("Could not change furniture.");
    } finally {
      setChangingFurniture(false);
    }
  };

  // Update task progress.
  // Slider drag → log=false: silent PATCH, no refetch (avoid re-render mid-drag).
  // Drag end   → log=true:  PATCH + refetch, and backend logs history.
  // Backend emits task_complete at 100% regardless.
  const onUpdateTaskProgress = async (taskId, newNum, log = false) => {
    const url = `${API}/api/tasks/${taskId}${log ? "?log=true" : ""}`;
    const r = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressNumerator: newNum }),
    });
    if (r.ok && log) {
      // Only refetch on drag end. task_complete will also trigger a refetch via socket.
      const fresh = await refetchRoom();
      setRoom(fresh);
    }
  };

  // Leave room. Backend handles owner transfer / last member → inactive.
  const onLeave = async () => {
    const ok = await confirm({
      title: "Leave this room?",
      message:
        "You can rejoin anytime, but your current session in this room will end.",
      confirmLabel: "Leave",
      variant: "danger",
    });
    if (!ok) return;
    const r = await fetch(`${API}/api/rooms/${room._id}/leave`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      navigate("/rooms");
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "Failed to leave room.");
    }
  };

  // Error / loading states.
  // Room missing / load failed / not a member → redirect to /join/:uid.
  useEffect(() => {
    if (roomError) navigate(`/join/${roomUid}`, { replace: true });
  }, [roomError, roomUid, navigate]);

  useEffect(() => {
    if (room && room.isMember === false) {
      navigate(`/join/${roomUid}`, { replace: true });
    }
  }, [room, roomUid, navigate]);

  if (roomError) return null;
  if (room && room.isMember === false) return null;
  if (!self || !room) {
    return (
      <div className="live-loading">
        <PushOutLoader color="var(--green)" />
        <div className="live-loading-text">entering the cozy room…</div>
      </div>
    );
  }

  const roomName = room.name ?? "Study Room";
  const memberCount = room.members?.length ?? 1;
  const onlineCount = onlineUserIds.length;

  // Session duration display
  const sessionText = (() => {
    if (!sessionStartAt) return "no session";
    const ms = now - new Date(sessionStartAt).getTime();
    if (ms < 0) return "session 0m";
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `session ${h}h ${m}m`;
    return `session ${m}m`;
  })();

  return (
    <div className={`live-page${selected === null ? " panel-hidden" : ""}`}>
      <div className="live-main">
        <PixelBox variant="retro" className="live-header">
          <div className="live-room-name">{roomName}</div>
          <div className="live-meta">
            <span className="live-meta-badge">
              <div className="live-dot" />
              {onlineCount} studying
            </span>
            <span>{sessionText}</span>
          </div>
        </PixelBox>

        <div className="live-stage">
          <PixelBox variant="retro" className="live-canvas">
            <div className="live-canvas-stack">
              <div className="live-canvas-ui">
                <SceneToolbar
                  furnitures={furnitures}
                  allowedFurnitureKeys={allowedFurnitureKeys}
                  currentFurnitureKey={selfSeat?.furnitureKey}
                  placement={selfSeat?.placement}
                  onFurnitureChange={onFurnitureChange}
                  changingFurniture={changingFurniture}
                />
                {incomingSeatInvite && (
                  <SeatInviteBanner
                    fromName={incomingSeatInvite.fromName}
                    onAccept={onSeatInviteAccept}
                    onDecline={onSeatInviteDecline}
                  />
                )}
              </div>
              <div
                ref={sceneRef}
                className="live-canvas-scene"
                onPointerDown={onScenePointerDown}
                onPointerMove={onScenePointerMove}
                onPointerUp={onScenePointerUp}
                onPointerCancel={onScenePointerUp}
                style={{
                  cursor: isDragging ? "grabbing" : "grab",
                  userSelect: "none",
                  touchAction: "pan-y",
                }}
              >
                {canvasSize.h > 0 && (
                  <RoomScene
                    layout={layout}
                    furnitures={furnitures}
                    canvasW={canvasSize.w}
                    canvasH={canvasSize.h}
                    sceneScale={sceneScale}
                    cameraX={cameraX}
                    isDragging={isDragging}
                    bg={bg}
                    selfUserId={self._id}
                    sceneTargetUserId={sceneTargetUserId}
                    scenePendingUserId={scenePendingUserId}
                    onSelectTarget={onSceneTargetSelect}
                    onAction={onSceneAction}
                    onPendingTimeout={onScenePendingTimeout}
                  />
                )}
              </div>
            </div>
          </PixelBox>

          <div className="live-members-row">
            <div className="live-members">
              <PixelBox
                variant="retro"
                className={`live-member-card is-self${selected === "self" ? " active" : ""}`}
                onClick={() =>
                  setSelected((p) => (p === "self" ? null : "self"))
                }
              >
                <Avatar
                  src={self.avatar}
                  displayName={self.displayName}
                  className="av-g"
                />
                <span className="live-member-name">{self.displayName}</span>
                <span className="live-member-pct">
                  {roomTasks.length
                    ? Math.round(
                        roomTasks.reduce(
                          (s, t) =>
                            s +
                            (t.progressDenominator
                              ? (t.progressNumerator / t.progressDenominator) *
                                100
                              : 0),
                          0,
                        ) / roomTasks.length,
                      )
                    : 0}
                  %
                </span>
              </PixelBox>
              {members.map((m) => {
                const avg = m.tasks?.length
                  ? Math.round(
                      m.tasks.reduce(
                        (s, t) =>
                          s +
                          (t.progressDenominator
                            ? (t.progressNumerator / t.progressDenominator) *
                              100
                            : 0),
                        0,
                      ) / m.tasks.length,
                    )
                  : null;
                return (
                  <PixelBox
                    key={m.uid}
                    variant="retro"
                    className={`live-member-card${selected === m.uid ? " active" : ""}`}
                    onClick={() =>
                      setSelected((p) => (p === m.uid ? null : m.uid))
                    }
                  >
                    <Avatar src={m.avatar} displayName={m.displayName} />
                    <span className="live-member-name">{m.displayName}</span>
                    <span className="live-member-pct">
                      {avg == null ? "—" : `${avg}%`}
                    </span>
                  </PixelBox>
                );
              })}
            </div>
            <PixelBox
              as="button"
              variant="retro"
              className={`live-member-overall-btn${selected === "overall" ? " active" : ""}`}
              onClick={() =>
                setSelected((p) => (p === "overall" ? null : "overall"))
              }
            >
              Overall
            </PixelBox>
            <PixelBox
              as="button"
              variant="retro"
              className="live-member-leave-btn"
              onClick={onLeave}
              title="Leave room"
            >
              {/* Pixel-style logout: three-sided door frame with arrow exiting right. Drawn on a 20x20 grid. */}
              <svg
                width="16"
                height="16"
                viewBox="3 3 9 9"
                fill="currentColor"
                shapeRendering="crispEdges"
                style={{ marginRight: -6 }}
              >
                <rect x="3" y="3" width="1" height="1" />
                <rect x="4" y="3" width="1" height="1" />
                <rect x="5" y="3" width="1" height="1" />
                <rect x="6" y="3" width="1" height="1" />
                <rect x="7" y="3" width="1" height="1" />
                <rect x="8" y="3" width="1" height="1" />
                <rect x="3" y="4" width="1" height="1" />
                <rect x="4" y="4" width="1" height="1" />
                <rect x="3" y="5" width="1" height="1" />
                <rect x="9" y="5" width="1" height="1" />
                <rect x="3" y="6" width="1" height="1" />
                <rect x="9" y="6" width="1" height="1" />
                <rect x="10" y="6" width="1" height="1" />
                <rect x="3" y="7" width="1" height="1" />
                <rect x="5" y="7" width="1" height="1" />
                <rect x="6" y="7" width="1" height="1" />
                <rect x="7" y="7" width="1" height="1" />
                <rect x="8" y="7" width="1" height="1" />
                <rect x="9" y="7" width="1" height="1" />
                <rect x="10" y="7" width="1" height="1" />
                <rect x="11" y="7" width="1" height="1" />
                <rect x="3" y="8" width="1" height="1" />
                <rect x="9" y="8" width="1" height="1" />
                <rect x="10" y="8" width="1" height="1" />
                <rect x="3" y="9" width="1" height="1" />
                <rect x="9" y="9" width="1" height="1" />
                <rect x="3" y="10" width="1" height="1" />
                <rect x="4" y="10" width="1" height="1" />
                <rect x="3" y="11" width="1" height="1" />
                <rect x="4" y="11" width="1" height="1" />
                <rect x="5" y="11" width="1" height="1" />
                <rect x="6" y="11" width="1" height="1" />
                <rect x="7" y="11" width="1" height="1" />
                <rect x="8" y="11" width="1" height="1" />
              </svg>
            </PixelBox>
          </div>
        </div>
      </div>

      <PixelBox
        variant="retro"
        className={`live-panel${selected === null ? " hidden" : ""}`}
      >
        <PixelBox
          variant="retro"
          className="live-panel-badge"
          style={{
            "--pixel-border-color": badgeColor,
            "--pixel-shadow": badgeShadow,
          }}
        >
          {badgeSrc ? (
            <img
              src={badgeSrc}
              alt="badge"
              className="live-panel-badge-img"
              crossOrigin="anonymous"
            />
          ) : (
            badgeInitials
          )}
        </PixelBox>
        <button
          type="button"
          className="live-panel-close"
          onClick={() => setSelected(null)}
        >
          <img
            src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/217233/scrapCross.png"
            alt=""
            width="15"
            height="15"
          />
        </button>
        {selected !== null && (
          <>
            <div className="live-panel-header">
              <div className="live-panel-who">
                {selected === "overall" ? (
                  <div className="live-panel-name">Overall</div>
                ) : selected === "self" ? (
                  <div className="live-panel-name">{self.displayName}</div>
                ) : (
                  panelMember && (
                    <div className="live-panel-name">
                      {panelMember.displayName}
                    </div>
                  )
                )}
              </div>
              <div className="live-panel-mode">
                {selected === "overall"
                  ? "all members"
                  : selected === "self"
                    ? "your progress"
                    : "viewing"}
              </div>
              {/* Kick button: only shown when viewing another member as owner.
                  Sits under "viewing" so it's grouped with the meta info. */}
              {isAdmin && panelMember && (
                <button
                  type="button"
                  className="live-panel-kick"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Remove from room?",
                      message: `${panelMember.displayName} will lose access to this room.`,
                      confirmLabel: "Remove",
                      variant: "danger",
                    });
                    if (ok) onKick(panelMember.userId);
                  }}
                >
                  remove from room
                </button>
              )}
            </div>
            <div className="live-panel-body">
              {selected === "self" && (
                <SelfPanel
                  tasks={selfTasks}
                  roomTasks={roomTasks}
                  onAddTask={onAddTask}
                  onRemoveTask={onRemoveTask}
                  onUpdateTaskProgress={onUpdateTaskProgress}
                  events={events}
                  isAdmin={isAdmin}
                  onApprove={onApprove}
                  onReject={onReject}
                  pendingUserIds={pendingUserIds}
                />
              )}
              {selected === "overall" && (
                <OverallPanel
                  allMembers={allMembers}
                  events={events}
                  isAdmin={isAdmin}
                  onApprove={onApprove}
                  onReject={onReject}
                  pendingUserIds={pendingUserIds}
                />
              )}
              {panelMember && (
                <MemberPanel
                  member={panelMember}
                  events={events}
                  isAdmin={isAdmin}
                  onApprove={onApprove}
                  onReject={onReject}
                  pendingUserIds={pendingUserIds}
                />
              )}
            </div>
          </>
        )}
      </PixelBox>
      {confirmModal}
    </div>
  );
}
