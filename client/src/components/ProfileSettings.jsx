import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";
import SchoolSearch from "./SchoolSearch";
import "../styles/ProfileSettings.css";

const GRADUATION_YEARS = Array.from({ length: 10 }, (_, i) => 2024 + i);

export default function ProfileSettings() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftSchool, setDraftSchool] = useState("");
  const [schoolConfirmed, setSchoolConfirmed] = useState(true);

  // email
  const [draftEmail, setDraftEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState(false);

  // password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setDraftName(data.displayName ?? "");
        setDraftSchool(data.school ?? "");
      });
  }, []);

  const fileInputRef = useRef(null);

  // Resize + center-crop to 256x256, keeping base64 around 20KB to stay well under Mongo's 16MB doc limit
  const fileToAvatarDataURL = async (file) => {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const image = new Image();
        image.onload = () => res(image);
        image.onerror = () => rej(new Error("Invalid image"));
        image.src = imgUrl;
      });
      const OUT = 256;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);
      return canvas.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still triggers change
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      setIsError(true);
      return;
    }
    let dataUrl;
    try {
      dataUrl = await fileToAvatarDataURL(file);
    } catch (err) {
      setMessage("Could not read image.");
      setIsError(true);
      return;
    }
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ avatar: dataUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setMessage("Avatar updated.");
      setIsError(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to update avatar.");
      setIsError(true);
    }
  };

  const handleSave = async () => {
    // School searchbox is in an unconfirmed state
    if (draftSchool && !schoolConfirmed) {
      setMessage("Please select a school from the dropdown.");
      setIsError(true);
      return;
    }
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        school: draftSchool,
        graduationYear: profile.graduationYear,
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
        displayName: draftName,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data);
      setMessage("Saved.");
      setIsError(false);
    } else {
      setMessage(data.error);
      setIsError(true);
    }
  };

  const handleEmailSave = async () => {
    if (!draftEmail) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/email`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: draftEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setEmailMsg("Email updated.");
      setEmailError(false);
      setDraftEmail("");
    } else {
      setEmailMsg(data.error);
      setEmailError(true);
    }
  };

  const handlePasswordSave = async () => {
    if (!oldPassword || !newPassword) return;
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/password`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      },
    );
    const data = await res.json();
    if (res.ok) {
      setPasswordMsg("Password updated.");
      setPasswordError(false);
      setOldPassword("");
      setNewPassword("");
    } else {
      setPasswordMsg(data.error);
      setPasswordError(true);
    }
  };

  if (!profile)
    return (
      <div className="main">
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
      </div>
    );

  return (
    <main className="main">
      <div className="main-inner">
        <div className="ps-title">Settings</div>

        {/* ── Avatar + username ── */}
        <div className="ps-section">
          <div className="ps-section-label">Profile</div>
          <div className="ps-avatar-row">
            <div className="ps-avatar-wrap">
              <img src={profile.avatar || defaultAvatar} alt="avatar" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarFile}
              />
              {/* Edit button in top-right corner */}
              <div
                className="ps-avatar-edit"
                title="Change avatar"
                onClick={handleAvatarClick}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
                </svg>
              </div>
            </div>
            <div className="ps-avatar-info">
              <div className="ps-username">{profile.displayName}</div>
              <div className="ps-username-sub">
                {profile.school || "No school set"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Account ── */}
        <div className="ps-section">
          <div className="ps-section-label">Account</div>
          <div className="ps-field">
            <div className="ps-label">Username</div>
            <input
              className="ps-input"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Enter display name"
            />
          </div>
        </div>

        {/* ── School ── */}
        <div className="ps-section">
          <div className="ps-section-label">Academic</div>
          <div className="ps-field">
            <div className="ps-label">School</div>
            <SchoolSearch
              value={draftSchool}
              onChange={(val) => setDraftSchool(val)}
              onConfirmChange={(v) => setSchoolConfirmed(v)}
            />
          </div>

          {/* Graduation Year */}
          <div className="ps-field">
            <div className="ps-label">Graduation Year</div>
            <div className="ps-select-wrap">
              <select
                className="ps-select"
                value={profile.graduationYear || ""}
                onChange={(e) =>
                  setProfile({ ...profile, graduationYear: e.target.value })
                }
              >
                <option value="">Select year</option>
                {GRADUATION_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Email ── */}
        <div className="ps-section">
          <div className="ps-section-label">Email</div>
          <div className="ps-field">
            <div className="ps-label">New Email</div>
            <input
              className="ps-input"
              type="email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              placeholder="Enter new email"
            />
          </div>
          <div className="ps-save-row">
            <button className="ps-btn ps-btn-primary" onClick={handleEmailSave}>
              Update Email
            </button>
            {emailMsg && (
              <div className={`ps-message${emailError ? " error" : ""}`}>
                {emailMsg}
              </div>
            )}
          </div>
        </div>

        {/* ── Password ── */}
        <div className="ps-section">
          <div className="ps-section-label">Password</div>
          <div className="ps-field">
            <div className="ps-label">Current Password</div>
            <input
              className="ps-input ink"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="ps-field">
            <div className="ps-label">New Password</div>
            <input
              className="ps-input ink"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div className="ps-save-row">
            <button
              className="ps-btn ps-btn-ghost"
              onClick={handlePasswordSave}
            >
              Update Password
            </button>
            {passwordMsg && (
              <div className={`ps-message${passwordError ? " error" : ""}`}>
                {passwordMsg}
              </div>
            )}
          </div>
        </div>

        {/* ── Save ── */}
        <div className="ps-save-row">
          <button className="ps-btn ps-btn-primary" onClick={handleSave}>
            Save Changes
          </button>
          {message && (
            <div className={`ps-message${isError ? " error" : ""}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
