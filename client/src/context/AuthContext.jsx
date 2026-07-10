import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined);

  const refetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
      const data = res.ok ? await res.json() : null;
      setCurrentUser(data);
      return data;
    } catch {
      setCurrentUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refetchCurrentUser();
  }, [refetchCurrentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, refetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
