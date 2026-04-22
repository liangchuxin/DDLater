import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RoomCard from "./RoomCard";

const API = import.meta.env.VITE_API_URL;

// 宽度模板: 第1行 w4 / 第2行 w3+w1 / 第3行 w2+w2,循环
const WIDTHS = [4, 3, 1, 2, 2];

const ROOM_FILTERS = ["All Rooms", "My School", "My Course"];

export default function StudyRoomsSection({
  title = "Study Rooms · join someone and get it done",
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All Rooms");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/rooms`, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setRooms([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRooms(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // create card 放在 rooms 末尾,占下一格的 width,保持模板规律
  const createWClass = `w${WIDTHS[rooms.length % WIDTHS.length]}`;

  return (
    <div className="rooms-page">
      <div className="sec-head">
        <div className="sec-title">{title}</div>
      </div>
      <div className="filter-bar">
        {ROOM_FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? "on" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="rooms-grid">
        {!loading && rooms.length === 0 && (
          <div
            style={{
              gridColumn: "span 4",
              padding: "48px 0",
              textAlign: "center",
              fontFamily: "DM Mono, monospace",
              fontSize: 14,
              color: "var(--muted)",
              letterSpacing: "0.06em",
            }}
          >
            No rooms yet.
          </div>
        )}
        {rooms.map((room, idx) => (
          <RoomCard
            key={room._id}
            room={room}
            wClass={`w${WIDTHS[idx % WIDTHS.length]}`}
          />
        ))}

        <div
          className={`rcard rcard-create ${createWClass}`}
          onClick={() => navigate("/live/create")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/live/create");
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ color: "var(--muted)" }}
          >
            <line x1="10" y1="4" x2="10" y2="16" />
            <line x1="4" y1="10" x2="16" y2="10" />
          </svg>
          <div className="rcard-create-label">Create a room</div>
          <div className="rcard-create-sub">
            Invite people working on the same thing
          </div>
        </div>
      </div>
    </div>
  );
}
