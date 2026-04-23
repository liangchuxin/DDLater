import { useState, useEffect, useMemo } from "react";
import FeedCard from "./FeedCard";
import StudyRoomsSection from "./StudyRoomsSection";
import PushOutLoader from "./PushOutLoader";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

const TASK_FILTERS = [
  "Everyone",
  "My School",
  "My Course",
  "Due Today",
  "0% Done",
];

// Card width template. 10-card loop: 4 w1 + (w2,w1,w1) + (w1,w1,w2).
const WIDTHS = [1, 1, 1, 1, 2, 1, 1, 1, 1, 2];

const CI_CLASSES = [
  "ci-1",
  "ci-2",
  "ci-3",
  "ci-4",
  "ci-5",
  "ci-6",
  "ci-7",
  "ci-8",
  "ci-9",
  "ci-a",
  "ci-b",
  "ci-c",
];

const COURSE_TAG_OPTIONS = ["t-ait", "t-se", "t-wd", "t-bd", "t-li"];

const DEPT_ALIASES = {
  CSCI: "CS",
  COMP: "CS",
};

function formatCourseCode(code) {
  if (!code) return "";
  const m = code.match(/^\s*([A-Za-z]+)(?:-[A-Za-z]+)?\s*(\d+)?/);
  if (!m) return code.toUpperCase();
  const dept = m[1].toUpperCase();
  const num = m[2];
  const short = DEPT_ALIASES[dept] ?? dept;
  return num ? `${short} ${num}` : short;
}

function abbreviateSchool(school) {
  if (!school) return "";
  const trimmed = school.trim();
  // Already a short all-caps acronym (e.g. "NYU"): keep as-is
  if (/^[A-Z]{2,6}$/.test(trimmed)) return trimmed;
  // Multi-word: take first letter of each, uppercased
  const words = trimmed.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) return words.map((w) => w[0].toUpperCase()).join("");
  // Single word: return as-is
  return trimmed;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isDueToday(task) {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  const now = new Date();
  const diffMs = due - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Due today / within 24h / overdue all count
  return diffDays < 1;
}

function taskToFeedCardProps(task, idx) {
  const profile = task.authorProfile || {};
  const course = task.course;
  const activeAvatar = profile.activeAvatar;
  const avatarGrid = activeAvatar?.avatarGrid ?? null;

  const courseCode = course?.courseCode ?? "LIFE";
  const courseTag = course
    ? COURSE_TAG_OPTIONS[hashString(courseCode) % COURSE_TAG_OPTIONS.length]
    : "t-li";
  const courseShort = course ? formatCourseCode(courseCode) : "LIFE";

  const bgClass = CI_CLASSES[idx % CI_CLASSES.length];

  const displayName = profile.displayName || "anonymous";
  const initials = getInitials(displayName);
  const dept = [abbreviateSchool(profile.school), profile.major]
    .filter(Boolean)
    .join(" ");

  // progress
  const num = task.progressNumerator ?? 0;
  const den = Math.max(task.progressDenominator ?? 1, 1);
  const percent = Math.min(100, Math.round((num / den) * 100));
  const done = num >= den;
  let progressText;
  if (done) progressText = "done ✓";
  else if (num === 0) progressText = "not started";
  else progressText = `${num} / ${den}`;

  let pfClass = "pf-r";
  if (percent >= 80) pfClass = "pf-g";
  else if (percent >= 40) pfClass = "pf-y";

  // deadline
  let ddlText = "no deadline";
  let ddlClass = "ddl-o";
  if (done) {
    ddlText = "submitted";
    ddlClass = "ddl-o";
  } else if (task.dueDate) {
    const due = new Date(task.dueDate);
    const now = new Date();
    const diffMs = due - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs < 0) {
      ddlText = "overdue";
      ddlClass = "ddl-u";
    } else if (diffDays < 1) {
      const hrs = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      ddlText = `due in ${hrs}h`;
      ddlClass = "ddl-u";
    } else if (diffDays < 7) {
      ddlText = `${Math.ceil(diffDays)}d left`;
      ddlClass = "ddl-s";
    } else {
      ddlText = `${Math.ceil(diffDays)}d left`;
      ddlClass = "ddl-o";
    }
  }

  const wide = WIDTHS[idx % WIDTHS.length] === 2;

  return {
    course: courseShort,
    courseTag,
    bgClass,
    dotStatus: task.authorInRoom ? "on" : "off",
    avatarGrid,
    initials,
    username: displayName,
    dept,
    task: task.title,
    progressText,
    percent,
    pfClass,
    ddlText,
    ddlClass,
    wide,
    active: false,
  };
}

export default function Dashboard() {
  const [taskFilter, setTaskFilter] = useState("Everyone");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Reference data for My School / My Course filters
  const [mySchool, setMySchool] = useState("");
  const [myTasks, setMyTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/tasks/feed`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setTasks([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch own profile + tasks to derive My School / My Course filters
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/profile`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMySchool(d.school ?? "");
      })
      .catch(() => {});
    fetch(`${API}/api/tasks`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMyTasks(Array.isArray(d) ? d : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Set of course codes I have tasks for. Used to flag "same course" feed entries.
  const myCourseCodes = useMemo(
    () => new Set(myTasks.map((t) => t.course?.courseCode).filter(Boolean)),
    [myTasks],
  );

  const filtered = useMemo(() => {
    if (taskFilter === "Due Today") return tasks.filter(isDueToday);
    if (taskFilter === "0% Done")
      return tasks.filter((t) => (t.progressNumerator ?? 0) === 0);
    if (taskFilter === "My School") {
      if (!mySchool) return [];
      return tasks.filter((t) => t.authorProfile?.school === mySchool);
    }
    if (taskFilter === "My Course") {
      if (myCourseCodes.size === 0) return [];
      return tasks.filter((t) => myCourseCodes.has(t.course?.courseCode));
    }
    // Everyone
    return tasks;
  }, [tasks, taskFilter, mySchool, myCourseCodes]);

  return (
    <main className="main">
      <div className="main-inner">
        <div className="sec-head">
          <div className="sec-title">What people are working on</div>
        </div>
        <div className="filter-bar">
          {TASK_FILTERS.map((f) => (
            <button
              key={f}
              className={`chip ${taskFilter === f ? "on" : ""} ${f === "0% Done" ? "warn" : ""}`}
              onClick={() => setTaskFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid">
          {loading ? (
            <div className="cards-loading cards-loading--fill">
              <PushOutLoader color="var(--green)" />
            </div>
          ) : (
            <>
              {filtered.length === 0 && (
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
                  No tasks yet.
                </div>
              )}

              {filtered.map((t, idx) => (
                <FeedCard key={t._id} {...taskToFeedCardProps(t, idx)} />
              ))}

              <div
                className="card card-promo"
                onClick={() => navigate("./avatar")}
              >
                <PixelPromo />
                <div className="promo-title">
                  Get your
                  <br />
                  pixel avatar!
                </div>
                <div className="promo-sub">COMING SOON →</div>
              </div>
            </>
          )}
        </div>

        <StudyRoomsSection />
      </div>
    </main>
  );
}

function PixelPromo() {
  return (
    <svg
      width="76"
      height="96"
      viewBox="0 0 13 17"
      style={{ imageRendering: "pixelated", opacity: 0.5 }}
    >
      <rect x="3" y="0" width="7" height="5" fill="#2D8A3E" />
      <rect x="2" y="5" width="9" height="7" fill="#4CAF62" />
      <rect x="1" y="7" width="2" height="3" fill="#4CAF62" />
      <rect x="10" y="7" width="2" height="3" fill="#4CAF62" />
      <rect x="3" y="12" width="3" height="4" fill="#2D8A3E" />
      <rect x="6" y="12" width="3" height="4" fill="#2D8A3E" />
      <rect x="4" y="1" width="1" height="1" fill="#dfc070" />
      <rect x="8" y="1" width="1" height="1" fill="#dfc070" />
    </svg>
  );
}
