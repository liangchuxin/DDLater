import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import logoLight from "../assets/logo.svg";

// 原来的简单 ul/li nav 已注释掉，换成带图标的 sidebar + header
/*
export default function Navigation() {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();
  const handleLogout = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setCurrentUser(null);
    navigate('/');
  };
  return (
    <ul>
      <li onClick={() => navigate('/')}>Feed</li>
      <li onClick={() => navigate('/rooms')}>Rooms</li>
      <li onClick={() => navigate('/tasks')}>My Tasks</li>
      <li onClick={() => navigate('/profile')}>Profile</li>
      <li onClick={handleLogout}>Logout</li>
    </ul>
  );
}
*/

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
    path: "/badges",
    label: "Badges",
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
        <polygon points="10,2 12.4,7.3 18,8.1 13.9,12.1 15,17.8 10,15 5,17.8 6.1,12.1 2,8.1 7.6,7.3" />
      </svg>
    ),
  },
];

export default function Navigation({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuth();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now); // 用的还是 now

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
          {/* <div className="brand-word">
            DD<span>Later</span>
          </div> */}
          <img src={logoLight} alt="DDLater" />
        </div>
        <div className="header-mid">
          <span className="h-date">{formatted}</span>
          {/* TODO: 之后换成实时在线人数 */}
          <span className="h-live">
            <div className="live-sq"></div>online
          </span>
        </div>
      </header>

      {/* .body: sidebar + 页面内容 */}
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
    </>
  );
}
