import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navigation() {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const handleLogout = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setCurrentUser(null); // 更新 App 里的 state
    navigate("/");
  };
  return (
    <>
      <ul>
        <li onClick={() => navigate("/")}>Feed</li>
        <li onClick={() => navigate("/rooms")}>Rooms</li>
        <li onClick={() => navigate("/tasks")}>My Tasks</li>
        <li onClick={() => navigate("/profile")}>Profile</li>
        <li onClick={handleLogout}>Logout</li>
      </ul>
    </>
  );
}
