import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { setCurrentUser } = useAuth();

  return (
    <>
      <h1>Dashboard</h1>
    </>
  );
}
