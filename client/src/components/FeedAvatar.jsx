import { useRef, useEffect } from "react";
import { renderStatic } from "../utils/pixelChar";

// Feed card user avatar. Renders nothing if grid is null.
// cellSize fixed at 3px, 26 cols = 78px wide. Height varies with grid rows.
// Canvas needs explicit width/height attrs; without them HTML defaults to 300x150,
// which stretches the parent card on first render before useEffect shrinks it back,
// causing visible layout jitter.
export default function FeedAvatar({ grid, cellSize = 3 }) {
  const ref = useRef(null);

  const rows = grid?.length ?? 0;
  const cols = grid?.[0]?.length ?? 26;
  const canvasW = cols * cellSize;
  const canvasH = rows * cellSize;

  useEffect(() => {
    if (!ref.current || !grid) return;
    const size = Math.max(cols, rows) * cellSize;
    renderStatic(ref.current, grid, size, true); // transparent=true
  }, [grid, cellSize, cols, rows]);

  if (!grid) return null;

  return (
    <canvas
      ref={ref}
      width={canvasW}
      height={canvasH}
      style={{
        imageRendering: "pixelated",
        position: "relative",
        zIndex: 1,
        display: "block",
      }}
    />
  );
}
