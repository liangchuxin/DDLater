import { useRef, useEffect } from "react";
import { renderStatic } from "../utils/pixelChar";

// feed card 里的用户 avatar。grid 为空就不渲染任何东西。
// cellSize 固定 3px,26 列 = 78px 宽。高度随 grid 行数变化。
// 注意: canvas 必须用 width/height attribute 设初始尺寸。不设的话 HTML 默认是
// 300×150,首次 render 会短暂撑宽父级 card(因为 grid 列 1fr = minmax(auto, 1fr),
// content min-width 会撑开 column)。useEffect 跑完 canvas 会收缩回正确尺寸,
// 从而造成"卡片变宽又变窄"的抖动。
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
