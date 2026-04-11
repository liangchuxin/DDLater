import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";
import "../Profile.css";

// mock badges — 之后从 API 取
const MOCK_BADGES = [
  "submitted 1 min before due",
  "0% at midnight warrior",
  "3pm club founding member",
];

export default function Profile() {
  const { currentUser } = useAuth();
  const { uid } = useParams();             // undefined when at /user
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  // 如果有 uid 参数就拉对应用户，否则拉自己
  const isOwnProfile = !uid || uid === currentUser?.uid;

  useEffect(() => {
    const url = uid
      ? `${import.meta.env.VITE_API_URL}/api/profile/${uid}`
      : `${import.meta.env.VITE_API_URL}/api/profile`;
    fetch(url, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setProfile(data));
  }, [uid]);

  if (!profile)
    return (
      <main className="main">
        <div
          className="main-inner"
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Loading…
        </div>
      </main>
    );

  // 头像首字母 fallback
  const initials = (profile.displayName || currentUser.username || "?")
    .split(" ")
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  // 学校 + 毕业年份
  const schoolLine = [
    profile.school ? profile.school.replace("University", "Univ.") : null,
    profile.graduationYear ? `Spring ${profile.graduationYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // mock 课程 — 之后从 API 取
  const courses = profile.courses?.length
    ? profile.courses
    : ["CSCI-UA 467", "CSCI-UA 474", "CSCI-UA 476", "CSCI-UA 4"];

  return (
    <main className="main">
      <div className="main-inner profile-page">
        {/* 头像区域 */}
        <div className="profile-hero">
          <div className="profile-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" />
            ) : (
              initials
            )}
          </div>
          <div className="profile-hero-info">
            {/* 如果当前页面 uid等同于当前登录用户 */}
            <div className="profile-name">
              {profile.displayName || currentUser.username}
            </div>
            {schoolLine && <div className="profile-school">{schoolLine}</div>}
          </div>
          {isOwnProfile && (
            <span
              className="profile-settings-link"
              onClick={() => navigate("/user/settings")}
            >
              Settings →
            </span>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.taskCount ?? 12}</div>
            <div className="profile-stat-label">Tasks Logged</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.roomCount ?? 4}</div>
            <div className="profile-stat-label">Rooms Joined</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">avg 10 pm</div>
            <div className="profile-stat-label">When Started</div>
          </div>
        </div>

        {/* ── My Courses + Badges ── */}
        <div className="profile-grid">
          <div className="profile-panel">
            <div className="profile-panel-title">My Courses</div>
            <div className="profile-courses">
              {courses.map((c) => (
                <div key={c} className="profile-course-item">
                  <div className="profile-course-dot" />
                  <div className="profile-course-name">{c}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-panel">
            <div className="profile-panel-title">Badges</div>
            {MOCK_BADGES.length === 0 ? (
              <div className="profile-empty">No badges yet</div>
            ) : (
              <div className="profile-badges">
                {MOCK_BADGES.map((b) => (
                  <div key={b} className="profile-badge-item">
                    <div className="profile-badge-dash">—</div>
                    <div className="profile-badge-text">{b}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
