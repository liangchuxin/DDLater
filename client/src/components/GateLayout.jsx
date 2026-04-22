import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoLight from "../assets/logo.svg";
import "../styles/GateLayout.css";

// 随机 bg 池。mount 时选一次,整个 session 不变。
const BG_OPTIONS = [
  "/backgrounds/bg1.gif",
  "/backgrounds/bg2.gif",
  "/backgrounds/bg3.gif",
];

// GateLayout: 给 /join /join/:roomId 等"门禁态"页面用的极简 layout。
// 无 sidebar,透明 header,底下一张 bg 图贴底。
// bgSrc 可由 route 指定;未传则从 BG_OPTIONS 随机一个
// ready=false 时整个 layout 不渲染（用于用户即将被 redirect 走的场景，避免 gate 闪一下）
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
