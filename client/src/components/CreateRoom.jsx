import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PixelBox from "./PixelBox";
import "../styles/CreateRoom.css";

const API = import.meta.env.VITE_API_URL;

// Background presets. Could later become dynamic (backend-driven or upload).
// Image files live under client/public/room/backgrounds/.
const BG_PRESETS = [
  { key: "bg-ai-wide.png", label: "Bedroom (default)", heightPct: 200, offsetX: 0, offsetY: -360 },
  // add more later
];

export default function CreateRoom() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bgPreset, setBgPreset] = useState(BG_PRESETS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const preset = BG_PRESETS.find((b) => b.key === bgPreset) ?? BG_PRESETS[0];
      const { label, ...background } = preset;
      const r = await fetch(`${API}/api/rooms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), background }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      const room = await r.json();
      navigate(`/live/${room.uid}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="create-room-page">
      <PixelBox variant="retro" className="create-room-card">
        <h1 className="create-room-title">Create a Study Room</h1>
        <p className="create-room-sub">
          You'll be the host. Share the room code with friends to let them join.
        </p>

        <form onSubmit={onSubmit} className="create-room-form">
          <label className="create-room-field">
            <span className="create-room-label">Room name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AIT final crunch"
              maxLength={60}
              autoFocus
              className="create-room-input"
            />
          </label>

          <div className="create-room-field">
            <span className="create-room-label">Background</span>
            <div className="create-room-bg-grid">
              {BG_PRESETS.map((bg) => (
                <button
                  key={bg.key}
                  type="button"
                  onClick={() => setBgPreset(bg.key)}
                  className={`create-room-bg-option${bgPreset === bg.key ? " active" : ""}`}
                >
                  <img
                    src={`/room/backgrounds/${bg.key}`}
                    alt={bg.label}
                    className="create-room-bg-thumb"
                  />
                  <span className="create-room-bg-caption">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="create-room-error">{error}</div>}

          <div className="create-room-actions">
            <button
              type="button"
              className="create-room-btn cancel"
              onClick={() => navigate("/rooms")}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-room-btn primary"
              disabled={!name.trim() || submitting}
            >
              {submitting ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </PixelBox>
    </div>
  );
}
