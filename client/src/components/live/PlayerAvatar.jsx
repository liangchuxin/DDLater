import { useEffect, useRef, useMemo } from "react";
import {
  startAnimation,
  defaultCuts,
  DEFAULT_ANIM_CONFIG,
  avatarCanvasDimensions,
} from "../../utils/pixelChar";
import { CHAR_REF_H, CHAR_REF_W } from "./roomConfig";

// When clipBottomRows > 0, pixelChar cuts that many rows off the bottom (e.g. hiding legs behind a sofa).
// Renders at a fixed reference pixel size, normalizes to a shared hitbox, then scales via CSS transform.
export default function PlayerAvatar({
  avatarGrid,
  avatarCuts,
  sceneScale = 1,
  clipBottomRows = 0,
  anchor = "bottom",
}) {
  const canvasRef = useRef(null);

  const layout = useMemo(() => {
    if (!avatarGrid) return null;
    const full = avatarCanvasDimensions(avatarGrid, CHAR_REF_H, 0);
    const normalizeScale = full.fullH > 0 ? CHAR_REF_H / full.fullH : 1;
    return {
      boxW: CHAR_REF_W * sceneScale,
      boxH: CHAR_REF_H * sceneScale,
      renderScale: normalizeScale * sceneScale,
    };
  }, [avatarGrid, sceneScale]);

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
      CHAR_REF_H,
      true,
      maxRow,
    );
    return stop;
  }, [avatarGrid, avatarCuts, clipBottomRows]);

  if (!avatarGrid || !layout) return null;

  return (
    <div
      style={{
        width: layout.boxW,
        height: layout.boxH,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          [anchor]: 0,
          left: "50%",
          transform: `translateX(-50%) scale(${layout.renderScale})`,
          transformOrigin: `${anchor} center`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ imageRendering: "pixelated", display: "block" }}
        />
      </div>
    </div>
  );
}
