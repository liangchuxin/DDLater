import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PixelBox from "./PixelBox";
import GateLayout from "./GateLayout";
import { useRoomSocket, useSocketEvent } from "../hooks/useSocket";
import "../styles/CreateRoom.css";

const API = import.meta.env.VITE_API_URL;

// JoinConfirm: /join/:roomId 的 gate 页。
// fetch 一次 room → 根据 isMember / isPending / active / 不存在 走不同分支。
// back 默认按 ?from=rooms 回 /rooms，其他回 /；full 态下强制回 /rooms。
export default function JoinConfirm() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const backTo = params.get("from") === "rooms" ? "/rooms" : "/";

  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | idle | waiting | checking | not-found | inactive | rejected | error
  const [message, setMessage] = useState(null);

  // socket 只在 waiting 态订阅;member_joined 事件的 actor 是自己时跳 live
  useRoomSocket(status === "waiting" ? roomId : null, (event) => {
    if (!myId) return;
    if (
      event.type === "member_joined" &&
      String(event.actor?._id) === String(myId)
    ) {
      navigate(`/live/${roomId}`);
    }
  });

  // 订阅个人通知：被 reject 时切到 rejected 态
  // 只在 waiting 态订阅，避免别的页面也反应历史事件
  useSocketEvent(
    "join-rejected",
    (data) => {
      if (data?.roomUid === roomId) setStatus("rejected");
    },
    status === "waiting",
  );

  const loadRoom = useCallback(async () => {
    try {
      const meResp = await fetch(`${API}/api/auth/me`, {
        credentials: "include",
      });
      const me = await meResp.json();
      setMyId(me._id);

      const r = await fetch(`${API}/api/rooms/${roomId}`, {
        credentials: "include",
      });
      if (r.status === 404) {
        setStatus("not-found");
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setRoom(data);

      if (!data.active) {
        setStatus("inactive");
        return;
      }
      if (data.isMember) {
        navigate(`/live/${roomId}`, { replace: true });
        return;
      }
      if (data.isPending) {
        setStatus("waiting");
        return;
      }
      if (data.isFull) {
        setStatus("full");
        return;
      }
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  }, [roomId, navigate]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const onRequest = async () => {
    setStatus("checking");
    setMessage(null);
    try {
      const r = await fetch(`${API}/api/rooms/${roomId}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      setStatus("waiting");
    } catch (err) {
      setStatus("idle");
      setMessage(err.message);
    }
  };

  // loading 态不渲染任何东西——避免 GateLayout 的 bg/header 在 redirect 前闪一下
  if (status === "loading") return null;

  if (status === "not-found" || status === "error") {
    return (
      <GateLayout>
      <div className="create-room-page">
        <PixelBox variant="retro" className="create-room-card">
          <h1 className="create-room-title">
            {status === "not-found" ? "Room not found" : "Something went wrong"}
          </h1>
          <p className="create-room-sub">
            {status === "not-found"
              ? "No room exists with that code. It may have been closed or the link could be wrong."
              : message || "Couldn't load this room."}
          </p>
          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn primary"
              onClick={() => navigate(backTo)}
            >
              Back
            </button>
          </div>
        </PixelBox>
      </div>
      </GateLayout>
    );
  }

  if (status === "inactive") {
    return (
      <GateLayout>
      <div className="create-room-page">
        <PixelBox variant="retro" className="create-room-card">
          <h1 className="create-room-title">Room is closed</h1>
          <p className="create-room-sub">
            <strong>{room?.name}</strong> is no longer active. The last member
            left.
          </p>
          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn primary"
              onClick={() => navigate(backTo)}
            >
              Back
            </button>
          </div>
        </PixelBox>
      </div>
      </GateLayout>
    );
  }

  if (status === "waiting") {
    return (
      <GateLayout>
      <div className="create-room-page">
        <PixelBox variant="retro" className="create-room-card">
          <h1 className="create-room-title">Waiting for approval</h1>
          <p className="create-room-sub">
            Your request to join <strong>{room?.name}</strong> has been sent.
            The host needs to approve you before you can enter.
          </p>
          <p
            className="create-room-sub"
            style={{ marginTop: 16, fontSize: 12 }}
          >
            You'll be taken into the room automatically once approved.
          </p>
          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn cancel"
              onClick={() => navigate(backTo)}
            >
              Back
            </button>
          </div>
        </PixelBox>
      </div>
      </GateLayout>
    );
  }

  if (status === "full") {
    return (
      <GateLayout>
      <div className="create-room-page">
        <PixelBox variant="retro" className="create-room-card">
          <h1 className="create-room-title">Room is full</h1>
          <p className="create-room-sub">
            <strong>{room?.name}</strong> already has the maximum of 4 members.
            You can try again later if someone leaves.
          </p>
          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn primary"
              onClick={() => navigate("/rooms")}
            >
              Back
            </button>
          </div>
        </PixelBox>
      </div>
      </GateLayout>
    );
  }

  if (status === "rejected") {
    return (
      <GateLayout>
      <div className="create-room-page">
        <PixelBox variant="retro" className="create-room-card create-room-card-rejected">
          <h1 className="create-room-title create-room-title-rejected">Request rejected</h1>
          <p className="create-room-sub">
            The host of <strong>{room?.name}</strong> declined your request to join.
          </p>
          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn primary"
              onClick={() => navigate(backTo)}
            >
              Back
            </button>
          </div>
        </PixelBox>
      </div>
      </GateLayout>
    );
  }

  // idle
  return (
    <GateLayout>
    <div className="create-room-page">
      <PixelBox variant="retro" className="create-room-card">
        <h1 className="create-room-title">Join {room?.name}?</h1>
        <p className="create-room-sub">
          You're not a member of this room yet. Send a request and the host
          will approve you.
        </p>
        {message && <div className="create-room-error">{message}</div>}
        <div className="create-room-actions">
          <button
            type="button"
            className="create-room-btn cancel"
            onClick={() => navigate(backTo)}
            disabled={status === "checking"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="create-room-btn primary"
            onClick={onRequest}
            disabled={status === "checking"}
          >
            {status === "checking" ? "Sending..." : "Request to join"}
          </button>
        </div>
      </PixelBox>
    </div>
    </GateLayout>
  );
}
