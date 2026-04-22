import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PixelBox from "./PixelBox";
import GateLayout from "./GateLayout";
import "../styles/CreateRoom.css";

const API = import.meta.env.VITE_API_URL;

// 共享 form:只负责 code → 验证 → 回调。
// 不自己跳转不自己 waiting,所有后续交给父级。
// onSuccess(roomId, nextStatus) 其中 nextStatus 是 'member' | 'pending'
// compact=true 时隐藏 title(modal 用)
export function JoinRoomCodeForm({
  onSuccess,
  onCancel,
  initialCode = "",
  compact = false,
  autoJoin = true, // true=自动发申请; false=只验证 code,不发申请
}) {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState("idle"); // idle | checking
  const [message, setMessage] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || status === "checking") return;
    setStatus("checking");
    setMessage(null);

    try {
      // 1. 确认 room 存在
      const getResp = await fetch(`${API}/api/rooms/${trimmed}`, {
        credentials: "include",
      });
      if (getResp.status === 404) {
        setStatus("idle");
        setMessage("No room found with that code.");
        return;
      }
      if (!getResp.ok) {
        const data = await getResp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${getResp.status}`);
      }
      const roomData = await getResp.json();

      // 2. 已经是 member:直接交给父级跳 live
      if (roomData.isMember) {
        onSuccess?.(roomData.uid, "member");
        return;
      }

      // 3. 已经 pending 或 autoJoin=false:跳去 /join/:roomId 让 JoinConfirm 接手
      if (roomData.isPending || !autoJoin) {
        onSuccess?.(roomData.uid, "pending");
        return;
      }

      // 4. 发申请
      const joinResp = await fetch(`${API}/api/rooms/${roomData.uid}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!joinResp.ok) {
        const data = await joinResp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${joinResp.status}`);
      }
      onSuccess?.(roomData.uid, "pending");
    } catch (err) {
      setStatus("idle");
      setMessage(err.message);
    }
  };

  return (
    <>
      {!compact && <h1 className="create-room-title">Join a Study Room</h1>}
      <p className="create-room-sub">
        Enter the 7-digit room code shared with you. An admin will approve your
        request before you can enter.
      </p>
      <form onSubmit={onSubmit} className="create-room-form">
        <label className="create-room-field">
          <span className="create-room-label">Room code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (message) setMessage(null);
            }}
            placeholder="e.g. 0991141"
            maxLength={10}
            autoFocus
            className="create-room-input"
            inputMode="numeric"
          />
        </label>
        {message && <div className="create-room-error">{message}</div>}
        <div className="create-room-actions">
          <button
            type="button"
            className="create-room-btn cancel"
            onClick={onCancel}
            disabled={status === "checking"}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="create-room-btn primary"
            disabled={!code.trim() || status === "checking"}
          >
            {status === "checking" ? "Joining..." : "Join Room"}
          </button>
        </div>
      </form>
    </>
  );
}

// JoinCodePage:独立页面 `/join` route 用
export default function JoinCodePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleSuccess = (roomId, nextStatus) => {
    if (nextStatus === "member") navigate(`/live/${roomId}`);
    else navigate(`/join/${roomId}`);
  };

  return (
    <GateLayout>
    <div className="create-room-page">
      <PixelBox variant="retro" className="create-room-card">
        <JoinRoomCodeForm
          initialCode={params.get("code") ?? ""}
          onCancel={() => navigate("/")}
          onSuccess={handleSuccess}
        />
      </PixelBox>
    </div>
    </GateLayout>
  );
}

// JoinRoomModal:挂 navbar,不占 URL
export function JoinRoomModal({ open, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;

  const handleSuccess = (roomId, nextStatus) => {
    onClose();
    if (nextStatus === "member") navigate(`/live/${roomId}`);
    else navigate(`/join/${roomId}`);
  };

  return (
    <div className="join-modal-backdrop" onClick={onClose}>
      <PixelBox
        variant="retro"
        className="create-room-card join-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <JoinRoomCodeForm
          onCancel={onClose}
          onSuccess={handleSuccess}
        />
      </PixelBox>
    </div>
  );
}
