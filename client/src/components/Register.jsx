import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PixelBox from "./PixelBox";
import "../styles/Auth.css";

export default function Register() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, password }),
      },
    );
    const data = await res.json();
    if (res.ok) {
      setMessage(data.message || "Account created. You can sign in now.");
      setIsSuccess(true);
    } else {
      setMessage(data.error);
      setIsSuccess(false);
    }
  };

  return (
    <div className="auth-page">
      <img
        src="/auth/characters.png"
        alt=""
        className="auth-bg"
        aria-hidden="true"
      />

      <div className="auth-card-wrap">
        <PixelBox variant="retro" className="auth-card">
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">
            Join a study room, track your deadlines, cheer each other on.
          </p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Display name</label>
              <input
                className="auth-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {message && (
              <div className={`auth-msg ${isSuccess ? "success" : "error"}`}>
                {message}
              </div>
            )}
            <button type="submit" className="auth-btn">
              Create account
            </button>
          </form>
          <p className="auth-swap">
            Already have an account?{" "}
            <button
              type="button"
              className="auth-swap-link"
              onClick={() => navigate("/login")}
            >
              Sign in
            </button>
          </p>
        </PixelBox>
      </div>
    </div>
  );
}
