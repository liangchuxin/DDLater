import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PixelBox from "./PixelBox";
import GateLayout from "./GateLayout";
import "../styles/CreateRoom.css";

const API = import.meta.env.VITE_API_URL;

// Shared form: validates code, then calls back. Doesn't navigate or wait itself.
// onSuccess(roomId, nextStatus) where nextStatus is 'member' | 'pending'.
// compact=true hides the title (used inside the modal).
export function JoinRoomCodeForm({
  onSuccess,
  onCancel,
  initialCode = "",
  compact = false,
  autoJoin = true, // true = send the request automatically; false = just validate the code
}) {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState("idle"); // idle | checking
  const [message, setMessage] = useState(null);
  // infoMessage: non-error hint (e.g. "room is full"); styled without the pink error box
  const [infoMessage, setInfoMessage] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || status === "checking") return;
    setStatus("checking");
    setMessage(null);
    setInfoMessage(null);

    try {
      // 1. Check the room exists
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

      // 2. Already a member: hand off to parent to go to live
      if (roomData.isMember) {
        onSuccess?.(roomData.uid, "member");
        return;
      }

      // 3. Already pending or autoJoin=false: redirect to /join/:roomId, JoinConfirm takes over
      if (roomData.isPending || !autoJoin) {
        onSuccess?.(roomData.uid, "pending");
        return;
      }

      // 4. Room full: don't send request, show info (not error)
      if (roomData.isFull) {
        setStatus("idle");
        setInfoMessage("This room is full (max 4 members).");
        return;
      }

      // 5. Send the request
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
        Enter the 7-digit room code shared with you. The host will approve your
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
              if (infoMessage) setInfoMessage(null);
            }}
            placeholder="e.g. 0991141"
            maxLength={10}
            autoFocus
            className="create-room-input"
            inputMode="numeric"
          />
        </label>
        {message && <div className="create-room-error">{message}</div>}
        {infoMessage && <div className="create-room-info">{infoMessage}</div>}
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

// JoinCodePage: standalone page for the `/join` route
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

// JoinRoomModal: mounted from the navbar, doesn't take over the URL
export function JoinRoomModal({ open, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleSuccess = (roomId, nextStatus) => {
    onClose();
    if (nextStatus === "member") navigate(`/live/${roomId}`);
    else navigate(`/join/${roomId}`);
  };

  return (
    <div
      className="join-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join a study room"
    >
      <div className="join-modal-shell" onClick={(e) => e.stopPropagation()}>
        <PixelBox variant="retro" className="create-room-card join-modal-card">
          <JoinRoomCodeForm onCancel={onClose} onSuccess={handleSuccess} />
        </PixelBox>
      </div>
    </div>
  );
}
