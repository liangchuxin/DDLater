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
import { Avatar, SelfPanel, MemberPanel, OverallPanel } from "./live/Panels";
import {
  CANVAS_REF_H,
  CHAR_REF_H,
  WORLD_SCALE,
  SIDE_MIN_FROM_CENTER,
  BG_SRC,
  BG_HEIGHT_PCT,
  BG_OFFSET_X_REF,
  BG_OFFSET_Y_REF,
} from "./live/roomConfig";
import {
  getDominantColor,
  generateSeats,
  extendSeats,
  sideCenterX,
} from "./live/liveUtils";
import { useRoomSocket, useSocketEvent } from "../hooks/useSocket";
import PushOutLoader from "./PushOutLoader";
import { useConfirm } from "./ConfirmModal";
import "../styles/Live.css";

const API = import.meta.env.VITE_API_URL;

export default function Live() {
  const { uid: roomUid } = useParams();
  const navigate = useNavigate();

  // ── 选中状态 ──
  const [selected, setSelected] = useState("self");

  // ── Auth 当前用户 ──
  const [self, setSelf] = useState(null);
  const [selfProfile, setSelfProfile] = useState(null);
  const [selfTasks, setSelfTasks] = useState([]);

  // ── 确认弹窗 hook ──
  const { confirm, modal: confirmModal } = useConfirm();

  // ── Room 数据 ──
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [events, setEvents] = useState([]);

  // ── Presence & session ──
  const [onlineUserIds, setOnlineUserIds] = useState([]); // user _id 字串数组
  const [sessionStartAt, setSessionStartAt] = useState(null); // ISO 时间或 null
  const [now, setNow] = useState(Date.now()); // 每秒刷新让 session timer 走动

  // ── Badge 颜色 ──
  const [badgeColor, setBadgeColor] = useState("var(--green)");
  const [badgeShadow, setBadgeShadow] = useState("rgba(45,138,62,0.2)");

  // ── 场景数据 ──
  const [furnitures, setFurnitures] = useState([]);
  const [seats, setSeats] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const sceneRef = useRef(null);

  // ── Camera ──
  const [cameraX, setCameraX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startCameraX: 0,
    moved: false,
  });

  // ── Fetch：全局数据 ──
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
  }, []);

  // ── Fetch：room 数据 ──
  // 抽成独立函数，socket 收到事件或 approve/reject 后都调一次
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
    if (r.ok) setEvents(await r.json());
  }, [roomUid]);

  useEffect(() => {
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

  // Session timer：每秒 tick 更新显示。sessionStartAt 为 null 时显示“0 studying”状态
  useEffect(() => {
    if (!sessionStartAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionStartAt]);

  // ── 派生：admin (= owner) 判断 ──
  const isAdmin = useMemo(() => {
    if (!room || !self) return false;
    return String(room.owner?._id ?? room.owner) === String(self._id);
  }, [room, self]);

  // ── Socket：订阅房间事件 ──
  // 收到事件后：
  //   1. 将事件插到 events 列表开头，history UI 立刻更新
  //   2. 如果事件会改变 room 成员/任务状态，重新 fetch room
  const handleRoomEvent = useCallback(
    (event) => {
      // admin-only 事件对非 admin 过滤（后端 broadcast 没滤，前端自己滤）
      const adminOnly = [
        "join_request",
        "join_approved",
        "join_rejected",
      ].includes(event.type);
      if (adminOnly && !isAdmin) return;

      setEvents((prev) => [event, ...prev]);

      // 引起 members 列表/任务变化的事件，重新 fetch room
      const needsRefetch = [
        "member_joined",
        "leave",
        "member_kicked",
        "task_add",
        "task_remove",
        "task_complete",
        "task_progress",
        "join_request", // pendingMembers 列表变了
        "join_rejected", // pendingMembers 也变了,不 refetch 会导致其他 admin 的按钮不消失
      ].includes(event.type);
      if (needsRefetch)
        refetchRoom()
          .then(setRoom)
          .catch(() => {});
    },
    [isAdmin, refetchRoom],
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

  // ── Admin approve/reject ──
  const onApprove = async (userId) => {
    const r = await fetch(`${API}/api/rooms/${room._id}/approve/${userId}`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      // socket 广播会自动刷新 events + room，但手动 refetch 一次减少延迟感
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
      // 注意也要 refetchRoom 让 pendingMembers 同步,否则 UI 里按钮不会消失
      const fresh = await refetchRoom();
      setRoom(fresh);
      await refetchEvents();
    }
  };

  // ── Owner kick member ──
  // 后端广播 member_kicked 事件后 socket 会触发 refetch,这里手动再 refetch 一次减延迟感
  // 如果当前选中的就是被踢的那个成员,切回 self panel
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

  // ── 自己被别人踢了 ──
  // 个人 channel 'kicked-from-room' 事件,后端在踢的时候 emit
  // 在 Live 页听到直接走,不然继续在这里的话会被回及下次 refetch 判为非 member
  useSocketEvent(
    "kicked-from-room",
    (data) => {
      alert(`You were removed from ${data?.roomName || "this room"}.`);
      navigate("/rooms");
    },
    true,
  );

  // ── 派生：pendingMembers user id Set ──
  // HistoryList 靠这个决定 join_request 旁的按钮要不要显示
  const pendingUserIds = useMemo(() => {
    if (!room?.pendingMembers) return new Set();
    return new Set(room.pendingMembers.map((u) => String(u._id ?? u)));
  }, [room]);

  // ── 派生：members + roomTasks ──
  // members = 场景中除 self 外的所有人（要渲染成角色）
  // roomTasks = 自己在房间里的任务
  // room.members 里自己也在内，"members" 变量单指别人
  // 精简 room（非 member 的 gate 态）没有 members 字段，提前返回
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
          // 显式保留 User._id（presence 等地方要用）。注意 profile._id 不是 User._id
          userId: String(userId),
          tasks: m.tasks ?? [],
        });
      }
    });
    return { members: others, roomTasks: myTasks };
  }, [room, self]);

  // ── 背景设置 ──
  // room.background 存文件名+偏移；room 还没到 或 老数据没 background 时走 fallback
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

  // ── Bg 真实尺寸，用于 camera clamp ──
  const [bgNaturalSize, setBgNaturalSize] = useState({ w: 1568, h: 896 });
  useEffect(() => {
    const img = new Image();
    img.onload = () =>
      setBgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = bg.src;
  }, [bg.src]);

  // ── Camera bounds ──
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

  // ── Badge 颜色 ──
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

  // ── Canvas 尺寸 ──
  // dep 包含 self 和 room——两者到齐 JSX 才渲染、sceneRef 才挂载
  useLayoutEffect(() => {
    if (!sceneRef.current) return;
    const target = sceneRef.current.parentElement;
    if (!target) return;
    const { width, height } = target.getBoundingClientRect();
    if (height > 0)
      setCanvasSize({ w: Math.round(width), h: Math.round(height) });
  }, [self, room]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const target = sceneRef.current.parentElement;
    if (!target) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: Math.round(width), h: Math.round(height) });
    });
    obs.observe(target);
    return () => obs.disconnect();
  }, [self, room]);

  // ── 座位分配 ──
  // 首次调 generateSeats；后续 members 增加时调 extendSeats 增量补座
  // （直接重调 generateSeats 会打乱现有人的坐位）
  useEffect(() => {
    if (!furnitures.length || !self || !room) return;
    const allowedKeys =
      room.furnitures?.length > 0 ? new Set(room.furnitures) : null;
    const pool = allowedKeys
      ? furnitures.filter((f) => allowedKeys.has(f.key))
      : furnitures;
    const count = 1 + members.length;
    if (!seats) {
      const s = generateSeats(count, pool);
      if (s.length > 0) setSeats(s);
    } else if (count > seats.length) {
      // 有新成员：增量补座
      setSeats(extendSeats(seats, count, pool));
    } else if (count < seats.length) {
      // 有人离开：重新从头算（这种情况下场景风格不一致没问题）
      // 不硬要求保持原有人坐原位：room 人心散了重新洗牌也可以
      setSeats(generateSeats(count, pool));
    }
  }, [furnitures, self, room, members.length, seats]);

  // ── 选中变化时聚焦 camera ──
  useEffect(() => {
    if (!canvasSize.w || !seats) return;
    const k = canvasSize.h / CANVAS_REF_H;
    const sideMin = SIDE_MIN_FROM_CENTER * k;

    let targetIdx = null;
    if (selected === "self") targetIdx = 0;
    else if (selected === "overall") targetIdx = null;
    else {
      const found = members.findIndex((m) => m.uid === selected);
      if (found >= 0) targetIdx = found + 1;
    }

    let targetCanvasX = canvasSize.w / 2;
    if (targetIdx != null) {
      const seat = seats.find((s) => s.memberIdx === targetIdx);
      if (seat) {
        if (seat.position === "center") {
          const halfGap = seat.furniture.layout.charHalfGap * k;
          targetCanvasX =
            canvasSize.w / 2 + (seat.slotIndex === 0 ? -halfGap : halfGap);
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
  }, [selected, canvasSize.w, canvasSize.h, seats, members]);

  // ── 拖动手势 ──
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
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  // ── 派生：场景 layout ──
  // 把 isOnline 标记带到 member上，场景里渲染时会根据这个标记调透明度
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
        // m.userId 是 User._id，m._id 是 Profile._id——用 userId 才能对上 presence
        isOnline: onlineSet.has(String(m.userId)),
      })),
    ];
  }, [self, selfProfile, members, onlineUserIds]);

  const layout = useMemo(() => {
    if (!seats) return [];
    return seats
      .map((s) => ({ ...s, member: allMembersForScene[s.memberIdx] }))
      .filter((s) => s.member);
  }, [seats, allMembersForScene]);

  const charH =
    canvasSize.h > 0
      ? Math.round((CHAR_REF_H * canvasSize.h) / CANVAS_REF_H)
      : CHAR_REF_H;

  // ── 派生：Panel 用 ──
  const allMembers = self
    ? [{ ...self, profile: selfProfile, tasks: roomTasks }, ...members]
    : members;

  const panelMember = members.find((m) => m.uid === selected);
  const selfInitials = self?.displayName?.slice(0, 2).toUpperCase() ?? "...";
  const badgeInitials =
    selected === "self" || selected === "overall"
      ? selfInitials
      : (panelMember?.displayName?.slice(0, 2).toUpperCase() ?? "??");

  // ── Task add/remove ──
  // 成功后 socket 会广播 task_add/task_remove，handleRoomEvent 会 refetchRoom。
  // 这里再 refetch 一次避免自己错过自己的广播（理论上不会但稳定性优先）。
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

  // 更新 task 进度。slider 拖动时 log=false：静默 PATCH，不 refetch（避免 re-render 打断拖动）
  // 拖动结束时 log=true：PATCH + refetch，同时后端记 history
  // 后端检测到 100% 时无论如何 emit task_complete
  const onUpdateTaskProgress = async (taskId, newNum, log = false) => {
    const url = `${API}/api/tasks/${taskId}${log ? "?log=true" : ""}`;
    const r = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressNumerator: newNum }),
    });
    if (r.ok && log) {
      // 只在拖动结束时 refetch（task_complete 事件也会通过 socket 触发 refetch）
      const fresh = await refetchRoom();
      setRoom(fresh);
    }
  };

  // Leave room：调后端 DELETE，后端自动处理 owner 转移 / 最后人 → inactive
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

  // ── 错误/loading 态 ──
  // 房间不存在 / 加载失败 / 不是成员：统一 redirect 到 /join/:uid
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

  // Session 时长显示
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
            <div
              ref={sceneRef}
              onPointerDown={onScenePointerDown}
              onPointerMove={onScenePointerMove}
              onPointerUp={onScenePointerUp}
              onPointerCancel={onScenePointerUp}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "pan-y",
              }}
            >
              {seats && (
                <RoomScene
                  layout={layout}
                  canvasW={canvasSize.w}
                  canvasH={canvasSize.h}
                  charH={charH}
                  cameraX={cameraX}
                  isDragging={isDragging}
                  bg={bg}
                />
              )}
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
              {/* 像素风 logout：左边三边门框、朝右箭头穿出。按 20×20 网格画 */}
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
              {/* 踢人按钮: 只在看别的 member 且自己是 owner 时显示。
                  放在 "viewing" 下面,和 name/mode 归为同一组 meta 信息 */}
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
