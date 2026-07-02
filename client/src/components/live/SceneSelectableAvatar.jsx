import { useEffect } from "react";
import PixelBox from "../PixelBox";

const SCENE_ACTIONS = [
  { id: 1, label: "Can we switch seats?" },
];

export const SCENE_ACTION_TIMEOUT_SEC = 10;

function menuPlacementClass(entry) {
  if (entry.position === "left") return "is-right";
  if (entry.position === "right") return "is-left";
  return "is-above";
}

export default function SceneSelectableAvatar({
  entry,
  selfUserId,
  sceneTargetUserId,
  scenePendingUserId,
  onSelectTarget,
  onAction,
  onPendingTimeout,
  style,
  innerStyle,
  children,
}) {
  const isSelf = String(entry.userId) === String(selfUserId);
  const isSelected = sceneTargetUserId === entry.userId;
  const isPending =
    isSelected && String(scenePendingUserId) === String(entry.userId);
  const canSelect = !isSelf;

  useEffect(() => {
    if (!isPending) return undefined;
    const timer = window.setTimeout(() => {
      onPendingTimeout?.(entry);
    }, SCENE_ACTION_TIMEOUT_SEC * 1000);
    return () => window.clearTimeout(timer);
  }, [isPending, entry, onPendingTimeout]);

  return (
    <div
      style={{
        ...style,
        position: style?.position ?? "relative",
        pointerEvents: canSelect ? "auto" : "none",
        cursor: canSelect ? "pointer" : undefined,
        zIndex: isSelected ? 45 : style?.zIndex,
      }}
      onPointerDown={(e) => {
        if (canSelect) e.stopPropagation();
      }}
      onPointerUp={(e) => {
        if (canSelect) e.stopPropagation();
      }}
      onClick={(e) => {
        if (!canSelect) return;
        e.stopPropagation();
        onSelectTarget(isSelected ? null : entry.userId);
      }}
    >
      <div
        style={{
          position: "relative",
          display: "inline-block",
          ...innerStyle,
        }}
      >
        {children}
        {isSelected && (
          <div className="live-scene-select-ring" aria-hidden="true">
            <span className="live-scene-select-corner live-scene-select-corner-tl" />
            <span className="live-scene-select-corner live-scene-select-corner-tr" />
            <span className="live-scene-select-corner live-scene-select-corner-bl" />
            <span className="live-scene-select-corner live-scene-select-corner-br" />
          </div>
        )}
      </div>
      {isSelected && (
        <div
          className={`live-scene-action-menu ${menuPlacementClass(entry)}`}
          onClick={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {SCENE_ACTIONS.map((item) => (
            <PixelBox
              key={item.id}
              as="button"
              type="button"
              variant="retro"
              className={`live-scene-action-item${isPending ? " is-pending" : ""}`}
              disabled={isPending}
              aria-busy={isPending || undefined}
              style={
                isPending
                  ? {
                      "--scene-action-timeout": `${SCENE_ACTION_TIMEOUT_SEC}s`,
                    }
                  : undefined
              }
              onClick={() => !isPending && onAction?.(entry, item.id)}
            >
              <span className="live-scene-action-label">
                {isPending ? "Pending approval..." : `${item.id}. ${item.label}`}
              </span>
              <span className="live-scene-action-size" aria-hidden="true">
                {item.id}. {item.label}
              </span>
              {isPending && (
                <span className="live-scene-action-progress" aria-hidden="true">
                  <span className="live-scene-action-progress-fill" />
                </span>
              )}
            </PixelBox>
          ))}
        </div>
      )}
    </div>
  );
}
