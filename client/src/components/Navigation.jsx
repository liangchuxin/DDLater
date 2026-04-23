import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import logoLight from "../assets/logo.svg";
import { JoinRoomModal } from "./JoinRoom";

const NAV_ITEMS = [
  {
    path: "/",
    label: "Feed",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      >
        <rect x="2" y="2" width="7" height="7" rx="0.5" />
        <rect x="11" y="2" width="7" height="7" rx="0.5" />
        <rect x="2" y="11" width="7" height="7" rx="0.5" />
        <rect x="11" y="11" width="7" height="7" rx="0.5" />
      </svg>
    ),
  },
  {
    path: "/rooms",
    label: "Rooms",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="10" cy="7" r="3.2" />
        <path d="M3.5 18.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
        <circle cx="16" cy="6.5" r="2" opacity="0.45" />
        <path d="M16 10.5c2 .5 3.5 2.2 3.5 4.5" opacity="0.45" />
      </svg>
    ),
  },
  {
    path: "/tasks",
    label: "Tasks",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <rect x="3.5" y="2" width="13" height="16" rx="0.5" />
        <line x1="7" y1="7.5" x2="14" y2="7.5" />
        <line x1="7" y1="11" x2="12" y2="11" />
        <line x1="7" y1="14.5" x2="13.5" y2="14.5" />
      </svg>
    ),
  },
  {
    path: "/avatar",
    label: "Avatar",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 2C5.6 2 2 5.6 2 10c0 3.7 2.3 6.9 5.6 8.1.9.3 1.8-.3 1.9-1.3.2-2.2 2-3.8 4.2-3.8H14c2.2 0 4-1.8 4-4C18 5.6 14.4 2 10 2z" />
        <circle cx="6" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function Navigation({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuth();
  const [now, setNow] = useState(new Date());
  const [joinOpen, setJoinOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const formatted = `${get("weekday").toUpperCase()} ${get("month").toUpperCase()} ${get("day")}, ${get("year")} · ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  const handleLogout = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setCurrentUser(null);
    navigate("/login");
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand" onClick={() => navigate("/")}>
          <img src={logoLight} alt="DDLater" />
        </div>
        <div className="header-mid">
          <span className="h-date">{formatted}</span>
          <span className="h-live">
            <div className="live-sq"></div>online
          </span>
          <button
            type="button"
            className="h-join-btn"
            onClick={() => setJoinOpen(true)}
          >
            Join Room
          </button>
        </div>
      </header>

      <div className="body">
        <nav className="sidebar">
          {NAV_ITEMS.map(({ path, label, icon }) => (
            <div
              key={path}
              className={`nav-item ${location.pathname === path ? "active" : ""}`}
              data-label={label}
              onClick={() => navigate(path)}
            >
              {icon}
            </div>
          ))}

          <div className="sb-sp" />

          {/* Profile */}
          <div
            className={`nav-item ${["/user", "/user/settings"].includes(location.pathname) ? "active" : ""}`}
            data-label="Profile"
            onClick={() => navigate("/user")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <circle cx="10" cy="7" r="3.2" />
              <path d="M3 19c0-3.9 3.1-7 7-7s7 3.1 7 7" />
            </svg>
          </div>

          {/* Logout */}
          <div className="nav-item" data-label="Logout" onClick={handleLogout}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M13 15l4-5-4-5" />
              <path d="M17 10H7" />
              <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" />
            </svg>
          </div>
        </nav>
        {children}
      </div>
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}
