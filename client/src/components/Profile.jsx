import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";
import PixelBox from "./PixelBox";
import { useConfirm } from "./ConfirmModal";
import "../styles/Profile.css";

const API = import.meta.env.VITE_API_URL;

export default function Profile() {
  const { currentUser } = useAuth();
  const { uid } = useParams();             // undefined when at /user
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const { confirm, modal: confirmModal } = useConfirm();

  const isOwnProfile = !uid || uid === currentUser?.uid;

  const fetchProfile = useCallback(async () => {
    const url = uid
      ? `${API}/api/profile/${uid}`
      : `${API}/api/profile`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setProfile(data);
  }, [uid]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleDeleteRoom = async (roomId, roomName) => {
    const ok = await confirm({
      title: "Delete this room?",
      message: `"${roomName}" will be permanently closed. This can't be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${API}/api/rooms/${roomId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete room.");
      return;
    }
    fetchProfile();
  };

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

  // Initials fallback for avatar
  const initials = (profile.displayName || currentUser?.username || "?")
    .split(" ")
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  // School + graduation year
  const schoolLine = [
    profile.school ? profile.school.replace("University", "Univ.") : null,
    profile.graduationYear ? `Spring ${profile.graduationYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const courses = profile.courses ?? [];
  const ownedRooms = profile.ownedRooms ?? [];

  return (
    <main className="main">
      <div className="main-inner profile-page">
        {/* Avatar area */}
        <div className="profile-hero">
          <div className="profile-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" />
            ) : (
              initials
            )}
          </div>
          <div className="profile-hero-info">
            <div className="profile-name">
              {profile.displayName || currentUser?.username}
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
          <PixelBox variant="retro" className="profile-stat">
            <div className="profile-stat-value">{profile.daysOnDDLater ?? "—"}</div>
            <div className="profile-stat-label">Days on DDLater</div>
          </PixelBox>
          <PixelBox variant="retro" className="profile-stat">
            <div className="profile-stat-value">{profile.taskCount ?? "—"}</div>
            <div className="profile-stat-label">Tasks Logged</div>
          </PixelBox>
          <PixelBox variant="retro" className="profile-stat">
            <div className="profile-stat-value">{profile.roomCount ?? "—"}</div>
            <div className="profile-stat-label">Rooms Joined</div>
          </PixelBox>
        </div>

        {/* ── My Courses + My Rooms ── */}
        <div className="profile-grid">
          <div className="profile-panel">
            <div className="profile-panel-title">My Courses</div>
            {courses.length === 0 ? (
              <div className="profile-empty">No courses yet</div>
            ) : (
              <div className="profile-courses">
                {courses.map((c) => (
                  <div key={c} className="profile-course-item">
                    <div className="profile-course-dot" />
                    <div className="profile-course-name">{c}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-panel">
            <div className="profile-panel-title">My Rooms</div>
            {ownedRooms.length === 0 ? (
              <div className="profile-empty">No rooms created yet</div>
            ) : (
              <div className="profile-rooms">
                {ownedRooms.map((r) => (
                  <div key={r._id} className="profile-room-item">
                    <div
                      className="profile-room-name"
                      onClick={() => navigate(`/live/${r.uid}`)}
                    >
                      {r.name}
                    </div>
                    {isOwnProfile && (
                      <span
                        className="profile-room-delete"
                        onClick={() => handleDeleteRoom(r._id, r.name)}
                      >
                        delete
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {confirmModal}
    </main>
  );
}
