import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoLight from "../assets/logo.svg";
import "../styles/GateLayout.css";

// Random bg pool. Picked once on mount, stays for the session.
const BG_OPTIONS = [
  "/backgrounds/bg1.gif",
  "/backgrounds/bg2.gif",
  "/backgrounds/bg3.gif",
];

// GateLayout: minimal layout for gate-like pages (/join, /join/:roomId, etc).
// No sidebar, transparent header, bg image pinned to bottom.
// bgSrc can be set per-route; otherwise randomly picked from BG_OPTIONS.
// ready=false renders nothing, useful when the user is about to be redirected
// and we want to avoid a brief flash of the gate.
export default function GateLayout({ children, bgSrc, ready = true }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [randomBg] = useState(
    () => BG_OPTIONS[Math.floor(Math.random() * BG_OPTIONS.length)],
  );
  const finalBg = bgSrc ?? randomBg;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const formatted = `${get("weekday").toUpperCase()} ${get("month").toUpperCase()} ${get("day")}, ${get("year")} · ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  if (!ready) return null;

  return (
    <div className="gate-layout">
      <img className="gate-bg" src={finalBg} alt="" />
      <header className="gate-header">
        <div className="gate-brand" onClick={() => navigate("/")}>
          <img src={logoLight} alt="DDLater" />
        </div>
        <div className="gate-header-mid">
          <span className="gate-date">{formatted}</span>
          <span className="gate-online">
            <span className="gate-online-dot" />
            online
          </span>
        </div>
      </header>
      <main className="gate-content">{children}</main>
    </div>
  );
}
