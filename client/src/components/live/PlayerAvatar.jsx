import { useEffect, useRef } from "react";
import {
  startAnimation,
  defaultCuts,
  DEFAULT_ANIM_CONFIG,
} from "../../utils/pixelChar";

// When clipBottomRows > 0, pixelChar cuts that many rows off the bottom (e.g. hiding legs behind a sofa).
export default function PlayerAvatar({
  avatarGrid,
  avatarCuts,
  size = 80,
  clipBottomRows = 0,
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !avatarGrid || !avatarCuts) return;
    const cuts =
      avatarCuts.length === 3 ? avatarCuts : defaultCuts(avatarGrid.length);
    const maxRow =
      clipBottomRows > 0 ? avatarGrid.length - 1 - clipBottomRows : null;
    const stop = startAnimation(
      canvasRef.current,
      avatarGrid,
      { ...DEFAULT_ANIM_CONFIG, cuts },
      size,
      true,
      maxRow,
    );
    return stop;
  }, [avatarGrid, avatarCuts, size, clipBottomRows]);

  if (!avatarGrid) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}
