import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./MyTasks.css";

function formatDueDate(dueDate) {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due - now;
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (mins < 60) return `due in ${mins}m`;
  if (hours < 24) return `due in ${hours}h`;
  if (days === 1) return 'due tomorrow';
  if (days <= 7) return `due in ${days} days`;
  return `due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function ddlClass(dueDate) {
  if (!dueDate) return '';
  const diff = new Date(dueDate) - new Date();
  const hours = diff / (1000 * 60 * 60);
  if (diff < 0) return 'urgent';
  if (hours <= 6) return 'urgent';
  if (hours <= 24) return 'warn';
  return '';
}

function formatDeadlineBadge(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function TaskCard({ task, onComplete }) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(
    task.progressNumerator >= task.progressDenominator && task.progressDenominator > 0
  );
  // 变灰只跟初始 server 数据走，不随点击实时更新
  const [greyedOut] = useState(
    task.progressNumerator >= task.progressDenominator && task.progressDenominator > 0
  );
  const [localNumerator, setLocalNumerator] = useState(task.progressNumerator);
  const pct = task.progressDenominator
    ? Math.round((localNumerator / task.progressDenominator) * 100)
    : 0;
  const pc = pct === 100 ? 'done' : pct >= 50 ? '' : pct > 0 ? 'warn' : 'urgent';
  const courseLabel = task.course?.courseCode ?? '';
  const isDoneFromServer = greyedOut;
  const isUrgent = !isDoneFromServer && ddlClass(task.dueDate) === 'urgent';

  return (
    <div className={`mt-card${isUrgent ? ' mt-card-urgent' : ''}${isDoneFromServer ? ' mt-card-done' : ''}`}>
      <div className="mt-card-top">
        <div className="mt-card-name">{task.title}</div>
        <div className={`mt-card-pct ${pc}`}>{pct}%</div>
      </div>

      <div className="mt-prog-bar">
        <div
          className={`mt-prog-fill ${pc}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-card-meta">
        <span className={`mt-card-ddl ${ddlClass(task.dueDate)}`}>
          {ddlClass(task.dueDate) === 'urgent' && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
              <path d="M5 11V6" stroke="#2d8a3e" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M5 6 C5 6 2 5 2.5 2 C2.5 2 5.5 1.5 6 4.5 C6 4.5 5.5 6 5 6" fill="#4caf62"/>
              <path d="M5 7 C5 7 7 5.5 9 6.5 C9 6.5 8.5 9 6 8.5 C6 8.5 5 8 5 7" fill="#2d8a3e"/>
            </svg>
          )}
          {formatDueDate(task.dueDate)}
        </span>
        {courseLabel && <><span className="mt-card-dot">·</span><span className="mt-card-course">{courseLabel}</span></>}
        <span className="mt-card-progress">{task.progressNumerator} / {task.progressDenominator}</span>
      </div>

      <div className="mt-card-footer">
        <div className="mt-card-footer-left">
          <button
            className={`mt-card-complete${completed ? ' mt-card-complete-done' : ''}`}
            onClick={async e => {
              e.stopPropagation();
              const newCompleted = !completed;
              setCompleted(newCompleted);
              setLocalNumerator(newCompleted ? task.progressDenominator : 0);
              await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${task._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newCompleted
                  ? { progressNumerator: task.progressDenominator }
                  : { progressNumerator: 0 }
                ),
              });
              onComplete(task._id, newCompleted);
            }}
          >
            <span className="mt-card-complete-box">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,7 5,10 11,3" />
              </svg>
            </span>
            <span className="mt-card-complete-label">completed</span>
          </button>
          {task.dueDate && (
            <div className="mt-card-date-badge">
              {formatDeadlineBadge(task.dueDate)}
            </div>
          )}
        </div>
        <div className="mt-card-footer-right">
          <button className="mt-card-edit" onClick={() => navigate(`/tasks/${task._id}/edit`)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
            </svg>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/tasks`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          const aDone = a.progressNumerator >= a.progressDenominator && a.progressDenominator > 0;
          const bDone = b.progressNumerator >= b.progressDenominator && b.progressDenominator > 0;
          return aDone - bDone;
        });
        setTasks(sorted);
        setLoading(false);
      });
  }, []);

  return (
    <main className="main">
      <div className="main-inner">
        <div className="mt-header">
          <div className="mt-title">My Tasks</div>
          <button className="mt-add-btn" onClick={() => navigate("/tasks/add")}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="6.5" y1="1" x2="6.5" y2="12" />
              <line x1="1" y1="6.5" x2="12" y2="6.5" />
            </svg>
            Add Task
          </button>
        </div>

        {loading ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: 'var(--muted)' }}>No tasks yet. Add one!</div>
        ) : (
          <div className="mt-grid">
            {tasks.map(t => (
              <TaskCard key={t._id} task={t} onComplete={() => {}} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
