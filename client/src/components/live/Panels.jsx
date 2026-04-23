import { useState, useEffect } from "react";
import PixelBox from "../PixelBox";
import { pctClass, formatDue } from "./liveUtils";

// Round avatar; falls back to initials when src is missing.
export function Avatar({ src, displayName, className = "" }) {
  const initials = displayName?.slice(0, 2).toUpperCase() ?? "?";
  if (src)
    return (
      <img
        src={src}
        alt={displayName}
        className={`live-av live-av-img ${className}`}
      />
    );
  return <div className={`live-av ${className}`}>{initials}</div>;
}

// Relative time: "just now" / "Xm ago" / "Xh ago" / date.
function formatRelative(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Describe an event and whether its type ever allows approve/reject buttons.
// showApproveButton only marks "this type is eligible"; actual display also
// requires the actor to currently be in pendingMembers. Previously we relied on
// ev.resolvedAt alone, which could get out of sync with DB (resolvedAt is set
// via updateMany server-side without broadcast).
function describeEvent(ev) {
  const who = <strong>{ev.actor?.displayName ?? "Someone"}</strong>;
  const task = ev.payload?.taskTitle ? `"${ev.payload.taskTitle}"` : "a task";
  switch (ev.type) {
    case "join_request":
      return { text: <>{who} requested to join the room</>, showApproveButton: true };
    case "join_approved":
      return { text: <>{who} approved a join request</>, showApproveButton: false };
    case "join_rejected":
      return { text: <>{who} rejected a join request</>, showApproveButton: false };
    case "member_joined":
      return { text: <>{who} joined the room</>, showApproveButton: false };
    case "leave":
      return { text: <>{who} left the room</>, showApproveButton: false };
    case "member_kicked": {
      const target = ev.payload?.targetDisplayName || "a member";
      return {
        text: <>{who} removed <strong>{target}</strong> from the room</>,
        showApproveButton: false,
      };
    }
    case "task_add":
      return { text: <>{who} added {task}</>, showApproveButton: false };
    case "task_remove":
      return { text: <>{who} removed {task}</>, showApproveButton: false };
    case "task_complete":
      return { text: <>{who} completed {task}</>, showApproveButton: false };
    case "task_progress": {
      const num = ev.payload?.progressNumerator ?? 0;
      const den = ev.payload?.progressDenominator ?? 0;
      return {
        text: <>{who} updated {task} to {num}/{den}</>,
        showApproveButton: false,
      };
    }
    default:
      return { text: <>{who} — {ev.type}</>, showApproveButton: false };
  }
}

// History list rendered from events.
// isAdmin + onApprove/onReject + pendingUserIds are only used for join_request buttons.
// Buttons show only when BOTH conditions hold:
//   1. ev.resolvedAt is null (this specific event hasn't been acted on)
//   2. actor is currently in pendingMembers
function HistoryList({ events, isAdmin, onApprove, onReject, pendingUserIds }) {
  if (!events || events.length === 0) {
    return (
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        No activity yet.
      </div>
    );
  }
  return (
    <div className="live-history-list">
      {events.map((ev) => {
        const { text, showApproveButton } = describeEvent(ev);
        // Why both checks:
        //   - !ev.resolvedAt: this event hasn't been approve/rejected
        //   - stillPending: the user is still waiting
        // Pending alone would re-light old events when the same user re-requests.
        // resolvedAt alone gets stale across tabs / admins. Together they cover each other.
        const actorId = String(ev.actor?._id ?? "");
        const stillPending = actorId && pendingUserIds?.has(actorId);
        const notResolved = !ev.resolvedAt;
        const showButtons =
          isAdmin && showApproveButton && stillPending && notResolved;
        return (
          <div key={ev._id} className="live-history-item">
            <div className="live-history-text">{text}</div>
            <div className="live-history-time">{formatRelative(ev.createdAt)}</div>
            {showButtons && (
              <div className="live-history-actions">
                <button
                  type="button"
                  className="live-history-approve"
                  onClick={() => onApprove?.(ev.actor._id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="live-history-reject"
                  onClick={() => onReject?.(ev.actor._id)}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// AddTaskModal: pick from all tasks not already in the room.
function AddTaskModal({ onClose, onPick, selectedIds, tasks }) {
  const available = tasks.filter((t) => {
    const done =
      t.progressNumerator >= t.progressDenominator && t.progressDenominator > 0;
    return !done && !selectedIds.includes(t._id);
  });
  return (
    <div className="live-modal-backdrop" onClick={onClose}>
      <PixelBox
        variant="retro"
        className="live-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="live-modal-header">
          <div className="live-modal-title">Add Task</div>
          <button type="button" className="live-modal-close" onClick={onClose}>
            <img
              src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/217233/scrapCross.png"
              alt=""
              width="15"
              height="15"
            />
          </button>
        </div>
        <div className="live-modal-body">
          {available.length === 0 ? (
            <div className="live-modal-empty">No available tasks.</div>
          ) : (
            available.map((t) => {
              const num = t.progressNumerator ?? 0;
              const den = t.progressDenominator ?? 0;
              const course = t.course?.courseCode;
              return (
                <button
                  key={t._id}
                  type="button"
                  className="live-modal-task"
                  onClick={() => onPick(t)}
                >
                  <div className="live-modal-task-top">
                    <span className="live-modal-task-name">{t.title}</span>
                    {den > 0 && (
                      <span className="live-modal-task-frac">
                        {num}/{den}
                      </span>
                    )}
                  </div>
                  <div className="live-modal-task-meta">
                    <span>{formatDue(t.dueDate)}</span>
                    {course && (
                      <>
                        <span className="live-modal-task-dot">·</span>
                        <span>{course}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PixelBox>
    </div>
  );
}

// SelfPanel: own tasks + add button + remove menu.
export function SelfPanel({
  tasks,
  roomTasks,
  onAddTask,
  onRemoveTask,
  onUpdateTaskProgress,
  events,
  isAdmin,
  onApprove,
  onReject,
  pendingUserIds,
}) {
  const [showModal, setShowModal] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  // Live drag values override roomTasks during interaction.
  // taskId -> progressNumerator. Tasks not in the map use roomTasks value.
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    if (!menuFor) return;
    const hide = () => setMenuFor(null);
    const t = setTimeout(() => document.addEventListener("click", hide), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", hide);
    };
  }, [menuFor]);

  return (
    <>
      <div className="live-task-section">
        <div className="live-task-section-title">My Tasks</div>
        {roomTasks.length === 0 && (
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            No tasks added to this room yet.
          </div>
        )}
        {roomTasks.map((t) => {
          const num = overrides[t._id] ?? t.progressNumerator ?? 0;
          const den = t.progressDenominator ?? 0;
          const pct = den ? Math.round((num / den) * 100) : 0;
          const done = den > 0 && num >= den;
          return (
            <div key={t._id} className="live-task-row">
              <div className="live-task-label">
                <span className="live-task-name">{t.title}</span>
                <span className="live-task-pct-wrap">
                  <span className={`live-task-pct${done ? " done" : ""}`}>
                    {done ? "completed" : `${num}/${den}`}
                  </span>
                  <button
                    type="button"
                    className="live-task-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor((p) => (p === t._id ? null : t._id));
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <circle cx="3" cy="7" r="1.3" />
                      <circle cx="7" cy="7" r="1.3" />
                      <circle cx="11" cy="7" r="1.3" />
                    </svg>
                  </button>
                  {menuFor === t._id && (
                    <PixelBox
                      variant="retro"
                      className="live-task-menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="live-task-menu-item"
                        onClick={() => {
                          onRemoveTask(t._id);
                          setMenuFor(null);
                        }}
                      >
                        Remove from room
                      </button>
                    </PixelBox>
                  )}
                </span>
              </div>
              <input
                className="live-task-slider"
                type="range"
                min="0"
                max="100"
                value={pct}
                onChange={(e) => {
                  // Only update local override; don't PATCH yet (avoids out-of-order writes).
                  const newPct = Number(e.target.value);
                  const d = t.progressDenominator || 100;
                  const newNum = Math.round((newPct / 100) * d);
                  setOverrides((o) => ({ ...o, [t._id]: newNum }));
                }}
                onMouseUp={(e) => {
                  // PATCH once on release, with log=true so backend logs history.
                  const newPct = Number(e.target.value);
                  const d = t.progressDenominator || 100;
                  const newNum = Math.round((newPct / 100) * d);
                  onUpdateTaskProgress?.(t._id, newNum, true);
                  // Clear override after 1s so next render reads roomTasks.
                  setTimeout(() => {
                    setOverrides((o) => {
                      const next = { ...o };
                      delete next[t._id];
                      return next;
                    });
                  }, 1000);
                }}
                onTouchEnd={(e) => {
                  const newPct = Number(e.target.value);
                  const d = t.progressDenominator || 100;
                  const newNum = Math.round((newPct / 100) * d);
                  onUpdateTaskProgress?.(t._id, newNum, true);
                  setTimeout(() => {
                    setOverrides((o) => {
                      const next = { ...o };
                      delete next[t._id];
                      return next;
                    });
                  }, 1000);
                }}
              />
            </div>
          );
        })}
        <button
          className="live-add-task-btn"
          onClick={() => setShowModal(true)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          add task
        </button>
      </div>
      <div className="live-history-section">
        <div className="live-task-section-title">History</div>
        <HistoryList
          events={events}
          isAdmin={isAdmin}
          onApprove={onApprove}
          onReject={onReject}
          pendingUserIds={pendingUserIds}
        />
      </div>
      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onPick={(t) => {
            onAddTask(t);
            setShowModal(false);
          }}
          selectedIds={roomTasks.map((t) => t._id)}
          tasks={tasks}
        />
      )}
    </>
  );
}

// MemberPanel: read-only view of another member's tasks.
export function MemberPanel({
  member,
  events,
  isAdmin,
  onApprove,
  onReject,
  pendingUserIds,
}) {
  return (
    <>
      <div className="live-task-section">
        <div className="live-task-section-title">Tasks</div>
        {member.tasks.length === 0 && (
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            No tasks added to this room yet.
          </div>
        )}
        {member.tasks.map((t) => {
          const num = t.progressNumerator ?? 0;
          const den = t.progressDenominator ?? 0;
          const pct = den ? Math.round((num / den) * 100) : 0;
          const pc = pctClass(pct);
          const done = den > 0 && num >= den;
          return (
            <div key={t._id} className="live-task-row">
              <div className="live-task-label">
                <span className="live-task-name">{t.title}</span>
                <span className={`live-task-pct ${pc}`}>
                  {done ? "completed" : `${num}/${den}`}
                </span>
              </div>
              <div className="live-task-bar">
                <div
                  className={`live-task-bar-fill ${pc}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="live-history-section">
        <div className="live-task-section-title">History</div>
        <HistoryList
          events={events}
          isAdmin={isAdmin}
          onApprove={onApprove}
          onReject={onReject}
          pendingUserIds={pendingUserIds}
        />
      </div>
    </>
  );
}

// OverallPanel: aggregate progress across all members.
export function OverallPanel({ allMembers, events, isAdmin, onApprove, onReject, pendingUserIds }) {
  return (
    <>
      <div className="live-task-section">
        <div className="live-task-section-title">Overall Progress</div>
        {allMembers.map((m) => {
          const tasks = m.tasks ?? [];
          const avg = tasks.length
            ? Math.round(
                tasks.reduce(
                  (s, t) =>
                    s +
                    (t.progressDenominator
                      ? (t.progressNumerator / t.progressDenominator) * 100
                      : 0),
                  0,
                ) / tasks.length,
              )
            : 0;
          const pc = pctClass(avg);
          return (
            <div key={m.uid || m._id} className="live-task-row">
              <div className="live-task-label">
                <span className="live-task-name">{m.displayName}</span>
                <span className={`live-task-pct ${pc}`}>{avg}%</span>
              </div>
              <div className="live-task-bar">
                <div
                  className={`live-task-bar-fill ${pc}`}
                  style={{ width: `${avg}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="live-history-section">
        <div className="live-task-section-title">All Activity</div>
        <HistoryList
          events={events}
          isAdmin={isAdmin}
          onApprove={onApprove}
          onReject={onReject}
          pendingUserIds={pendingUserIds}
        />
      </div>
    </>
  );
}
