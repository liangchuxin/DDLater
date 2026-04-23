import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PixelBox from "./PixelBox";
import "../styles/Auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setCurrentUser(data);
      navigate("/");
    } else {
      setMessage(data.error);
    }
  };

  return (
    <div className="auth-page">
      {/* Fullscreen background, file at /client/public/auth/characters.png */}
      <img
        src="/auth/characters.png"
        alt=""
        className="auth-bg"
        aria-hidden="true"
      />

      {/* Centered PixelBox card */}
      <div className="auth-card-wrap">
        <PixelBox variant="retro" className="auth-card">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to pick up where you left off.</p>
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
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {message && <div className="auth-msg error">{message}</div>}
            <button type="submit" className="auth-btn">
              Sign in
            </button>
          </form>
          <p className="auth-swap">
            New here?{" "}
            <button
              type="button"
              className="auth-swap-link"
              onClick={() => navigate("/register")}
            >
              Create an account
            </button>
          </p>
        </PixelBox>
      </div>
    </div>
  );
}
