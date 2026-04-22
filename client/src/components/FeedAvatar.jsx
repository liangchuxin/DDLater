import { useRef, useEffect } from "react";
import { renderStatic } from "../utils/pixelChar";

// feed card 里的用户 avatar。grid 为空就不渲染任何东西。
// cellSize 固定 3px,26 列 = 78px 宽。高度随 grid 行数变化。
export default function FeedAvatar({ grid, cellSize = 3 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !grid) return;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 26;
    const size = Math.max(cols, rows) * cellSize;
    renderStatic(ref.current, grid, size, true); // transparent=true
  }, [grid, cellSize]);

  if (!grid) return null;

  return (
    <canvas
      ref={ref}
      style={{
        imageRendering: "pixelated",
        position: "relative",
        zIndex: 1,
        display: "block",
      }}
    />
  );
}
