import PixelRobot from "./PixelRobot";
import { CHARS } from "./roomsData";
import "./Rooms.css";
import { useNavigate, useLocation } from "react-router-dom";

// Group icon
export function RoomIcon() {
  return (
    <svg
      className="rcard-room-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="6" r="2.5" />
      <path d="M2 15c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="13" cy="6" r="1.8" opacity="0.5" />
      <path d="M13 10.5c2 .5 3 2 3 3.5" opacity="0.5" />
    </svg>
  );
}

// pixel line graph
export function SparklineSVG({ color = "#505090" }) {
  return (
    <svg
      className="sparkline-svg"
      viewBox="0 0 120 70"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width="5" height="5" fill={color} />
      <rect x="115" y="0" width="5" height="5" fill={color} />
      <rect x="0" y="65" width="5" height="5" fill={color} />
      <rect x="115" y="65" width="5" height="5" fill={color} />
      <polyline
        points="10,58 25,46 35,50 48,38 60,42 72,30 84,34 96,20 110,14"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="miter"
        strokeLinecap="square"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

function FullWidthStage({ members }) {
  return (
    <div className="rcard-stage sh-full ri-1">
      {members.map((m) => (
        <div key={m.key} className={`rfull-member${m.afk ? " afk" : ""}`}>
          <PixelRobot {...CHARS[m.key]} width={m.w} height={m.h} />
          <div className="rfm-name">{m.key}</div>
          {m.afk ? (
            <div className="rfm-afk">{m.afk}</div>
          ) : (
            <div className={`rfm-prog${m.progClass ? " " + m.progClass : ""}`}>
              {m.prog}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RoomCard({ room }) {
  const navigate = useNavigate();
  const isFullWidth = room.width === "w4";
  const isW3 = room.width === "w3";
  const cardClass = ["rcard", room.live ? "live" : "", room.width]
    .filter(Boolean)
    .join(" ");

  const stage = isFullWidth ? (
    <FullWidthStage members={room.members} />
  ) : (
    <div className={`rcard-stage ${room.stageBg} ${room.stageSize}`}>
      {room.members.length === 0 ? (
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            alignSelf: "center",
          }}
        >
          No one here yet
        </span>
      ) : (
        room.members.map((m) => (
          <PixelRobot key={m.key} {...CHARS[m.key]} width={m.w} height={m.h} />
        ))
      )}
    </div>
  );

  const body = (
    <div className="rcard-body" style={isW3 ? { borderTop: "none" } : {}}>
      <div className="rcard-title-row">
        <RoomIcon />
        <div className="rcard-title">{room.title}</div>
      </div>
      {isFullWidth && (
        <div className="rcard-subtitle">
          <div className="rcard-subtitle-dot" />
          {room.subtitle}
        </div>
      )}
      <div className="rcard-stats">
        <span>{room.tasks}</span>
        <span>{room.deadline}</span>
      </div>
      <div className="rcard-prog-bar">
        <div
          className={`rcard-prog-fill ${room.progClass}`}
          style={{ width: `${room.percent}%` }}
        />
      </div>
      <div className="rcard-footer">
        <span>{room.footer}</span>
        {room.footerRight && (
          <span className={room.footerRightClass}>{room.footerRight}</span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cardClass}
      style={room.empty ? { opacity: 0.5 } : {}}
      onClick={() => navigate("/live")}
    >
      <div className="rcard-header">
        <div className="rh-left">
          <span className={`rh-course ${room.courseTag}`}>{room.course}</span>
          <span className="rh-name">{room.name}</span>
        </div>
        <div className="rh-right">
          {room.live && <div className="rh-dot" />}
          {room.live ? room.memberCount : "○ empty"}
        </div>
      </div>

      {stage}

      {isW3 ? (
        <div className="rcard-body-row">
          {body}
          <div className="rcard-sparkline-panel">
            <SparklineSVG color="#505090" />
          </div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}
