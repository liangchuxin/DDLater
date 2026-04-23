import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { renderStatic } from "../utils/pixelChar";
import "../styles/Rooms.css";

// Static avatar renderer.
// cellSize is fixed per wClass so all members in one card share the same pixel density.
// Grid row count varies (height differs), but width (26 cols * cellSize) stays constant.
function StageAvatar({ grid, cellSize = 3 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !grid) return;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 26;
    const size = Math.max(cols, rows) * cellSize;
    renderStatic(ref.current, grid, size, true);
  }, [grid, cellSize]);
  if (!grid) return null;
  return (
    <canvas
      ref={ref}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}

// Course code formatting (kept consistent with Dashboard).
const DEPT_ALIASES = { CSCI: "CS", COMP: "CS" };
const COURSE_TAG_OPTIONS = ["rhc-ait", "rhc-se", "rhc-bd", "rhc-wd"];

function formatCourseCode(code) {
  if (!code) return "";
  const m = code.match(/^\s*([A-Za-z]+)(?:-[A-Za-z]+)?\s*(\d+)?/);
  if (!m) return code.toUpperCase();
  const dept = m[1].toUpperCase();
  const num = m[2];
  const short = DEPT_ALIASES[dept] ?? dept;
  return num ? `${short} ${num}` : short;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Aggregate room stats.
function computeRoomStats(room) {
  const members = room.members ?? [];
  const allTasks = members.flatMap((m) => m.tasks ?? []);

  // Completed / total
  const completedCount = allTasks.filter(
    (t) => t.progressDenominator > 0 && t.progressNumerator >= t.progressDenominator,
  ).length;
  const totalCount = allTasks.length;

  // Collective percent = sum(num) / sum(den) across all tasks
  let totalN = 0, totalD = 0;
  allTasks.forEach((t) => {
    totalN += t.progressNumerator ?? 0;
    totalD += Math.max(t.progressDenominator ?? 1, 1);
  });
  const collectivePercent = totalD > 0 ? Math.round((totalN / totalD) * 100) : 0;

  // Earliest dueDate
  const dueDates = allTasks
    .map((t) => t.dueDate)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d));
  const earliest = dueDates.length ? new Date(Math.min(...dueDates.map((d) => d.getTime()))) : null;

  let deadlineText = "no deadline", deadlineClass = "ddl-o";
  if (earliest) {
    const diffMs = earliest.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs < 0) {
      deadlineText = "overdue";
      deadlineClass = "ddl-u";
    } else if (diffDays < 1) {
      const hrs = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      deadlineText = `due in ${hrs}h`;
      deadlineClass = "ddl-u";
    } else if (diffDays < 7) {
      deadlineText = `due in ${Math.ceil(diffDays)}d`;
      deadlineClass = "ddl-s";
    } else {
      deadlineText = `due in ${Math.ceil(diffDays)}d`;
      deadlineClass = "ddl-o";
    }
  }

  // Session duration
  let sessionText = null;
  if (room.sessionStartAt) {
    const diff = Date.now() - new Date(room.sessionStartAt).getTime();
    if (diff >= 0) {
      const totalMin = Math.floor(diff / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      sessionText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }

  // Most common course
  const courseCounts = {};
  allTasks.forEach((t) => {
    const code = t.course?.courseCode;
    if (code) courseCounts[code] = (courseCounts[code] ?? 0) + 1;
  });
  let topCourse = null, maxC = 0;
  Object.entries(courseCounts).forEach(([c, count]) => {
    if (count > maxC) { maxC = count; topCourse = c; }
  });

  // Progress bar color
  let progClass = "urgent";
  if (collectivePercent >= 80) progClass = "";
  else if (collectivePercent >= 40) progClass = "warn";

  return {
    memberCount: members.length,
    completedCount,
    totalCount,
    totalN,
    totalD,
    collectivePercent,
    progClass,
    deadlineText,
    deadlineClass,
    sessionText,
    topCourse,
  };
}

// Stage config.
// cellSize = pixel size per dot. Within a wClass, all members share the same cellSize.
const STAGE_CONFIG = {
  w1: { cellSize: 2, maxMembers: 2 },
  w2: { cellSize: 3, maxMembers: 3 },
  w3: { cellSize: 3, maxMembers: 4 },
  w4: { cellSize: 4, maxMembers: 5 },
};

// Canvas reference dimensions, matching Live scene roomConfig.
const CANVAS_REF_W = 1435;
const CANVAS_REF_H = 722;

function roomBgUrl(room) {
  const key = room.background?.key;
  if (!key) return "/room/backgrounds/bg-ai-wide.png";
  return `/room/backgrounds/${key}`;
}

// background-position percentage: 0% = image top aligned with card top, 100% = image bottom at card bottom.
// offsetY default -360 (~CANVAS_REF_H/2) makes yPct near 100% so the image sits at the bottom.
function roomBgPosition(room) {
  const offsetX = room.background?.offsetX ?? 0;
  const offsetY = room.background?.offsetY ?? -360;
  const yPct = Math.max(0, Math.min(100, 50 + (-offsetY / CANVAS_REF_H) * 100));
  const xPct = Math.max(0, Math.min(100, 50 + (-offsetX / CANVAS_REF_W) * 100));
  return `${xPct}% ${yPct}%`;
}

// Group icon used in the body title-row.
function RoomIcon() {
  return (
    <svg
      className="rcard-room-icon"
      width="16"
      height="16"
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

export default function RoomCard({ room, wClass = "w1" }) {
  const navigate = useNavigate();
  const members = room.members ?? [];
  const bgUrl = roomBgUrl(room);
  const isLive = !!room.sessionStartAt;
  const cfg = STAGE_CONFIG[wClass] ?? STAGE_CONFIG.w1;
  const shown = members.slice(0, cfg.maxMembers);

  const stats = computeRoomStats(room);
  const courseShort = stats.topCourse ? formatCourseCode(stats.topCourse) : null;
  const courseTagClass = stats.topCourse
    ? COURSE_TAG_OPTIONS[hashString(stats.topCourse) % COURSE_TAG_OPTIONS.length]
    : null;

  return (
    <div
      className={`rcard ${wClass} ${isLive ? "live" : ""}`}
      onClick={() => navigate(`/live/${room.uid}`)}
    >
      <div className="rcard-header">
        <div className="rh-left">
          {courseShort && (
            <span className={`rh-course ${courseTagClass}`}>{courseShort}</span>
          )}
          <span className="rh-name">{room.name}</span>
        </div>
        <div className="rh-right">
          {isLive && <div className="rh-dot" />}
          <span>{stats.memberCount}</span>
        </div>
      </div>

      <div
        className="rcard-stage"
        style={{
          backgroundImage: `url("${bgUrl}")`,
          backgroundPosition: roomBgPosition(room),
        }}
      >
        {shown.length === 0 ? (
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              alignSelf: "center",
            }}
          >
            No one here yet
          </span>
        ) : (
          shown.map((m) => {
            const grid = m.profile?.activeAvatar?.avatarGrid;
            const name = m.profile?.displayName ?? "?";
            return (
              <div key={m._id ?? m.user?._id ?? name} className="rfull-member">
                <StageAvatar grid={grid} cellSize={cfg.cellSize} />
                <div className="rfm-name">{name}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="rcard-body">
        <div className="rcard-title-row">
          <RoomIcon />
          <div className="rcard-title">{room.name}</div>
        </div>
        {isLive && stats.sessionText && (
          <div className="rcard-subtitle">
            <div className="rcard-subtitle-dot" />
            {stats.memberCount} studying · session {stats.sessionText}
          </div>
        )}
        <div className="rcard-stats">
          <span>
            {stats.totalN} / {stats.totalD}
          </span>
          <span className={stats.deadlineClass}>{stats.deadlineText}</span>
        </div>
        <div className="rcard-prog-bar">
          <div
            className={`rcard-prog-fill ${stats.progClass}`}
            style={{ width: `${stats.collectivePercent}%` }}
          />
        </div>
        <div className="rcard-footer">
          <span>{stats.collectivePercent}% collective</span>
        </div>
      </div>
    </div>
  );
}
