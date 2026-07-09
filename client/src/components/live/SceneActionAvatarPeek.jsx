import { useEffect, useRef } from "react";
import { renderStatic } from "../../utils/pixelChar";

const PREVIEW_GRID_ROWS = 24;
const PREVIEW_HEIGHT = 54;

export default function SceneActionAvatarPeek({ avatarGrid }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !avatarGrid?.length) return;
    const cropped = avatarGrid.slice(
      0,
      Math.min(PREVIEW_GRID_ROWS, avatarGrid.length),
    );
    const rows = cropped.length;
    const cols = cropped[0]?.length ?? 26;
    const cellSize = Math.max(1, Math.floor(PREVIEW_HEIGHT / rows));
    const renderSize = Math.max(cols, rows) * cellSize;
    renderStatic(canvasRef.current, cropped, renderSize, true);
  }, [avatarGrid]);

  if (!avatarGrid?.length) return null;

  return (
    <div className="live-scene-action-avatar-peek" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
