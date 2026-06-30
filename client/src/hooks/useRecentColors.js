import { useCallback, useState } from "react";
import { normalizeHex } from "../utils/pixelGrid";

const STORAGE_KEY = "ddlater-avatar-recent-colors";
export const MAX_RECENT_COLORS = 14;

function readStoredColors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHex).filter(Boolean);
  } catch {
    return [];
  }
}

export function useRecentColors() {
  const [recentColors, setRecentColors] = useState(readStoredColors);

  const addRecentColor = useCallback((color) => {
    const hex = normalizeHex(color);
    if (!hex) return;
    setRecentColors((prev) => {
      const next = [
        hex,
        ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase()),
      ].slice(0, MAX_RECENT_COLORS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentColors, addRecentColor };
}
