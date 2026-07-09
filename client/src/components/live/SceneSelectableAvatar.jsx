import { useEffect, useLayoutEffect, useRef, useState } from "react";
import PixelBox from "../PixelBox";
import SceneActionAvatarPeek from "./SceneActionAvatarPeek";
import chairIcon from "../../assets/scene-actions/chair.png";
import birdIcon from "../../assets/scene-actions/bird.png";
import fireIcon from "../../assets/scene-actions/fire.png";
import envelopeIcon from "../../assets/scene-actions/envelope.png";
import {
  defaultMenuSide,
  MENU_SIDE_CLASS,
  MENU_VALIGN_CLASS,
  resolveSceneActionMenuPlacement,
} from "./sceneActionMenuPlacement";

const SCENE_ACTIONS = [
  { id: 1, label: "Can we switch seats?", enabled: true, icon: chairIcon },
  { id: 2, label: "Invite...", enabled: false, icon: birdIcon },
  { id: 3, label: "Chat...", enabled: false, icon: fireIcon },
  { id: 4, label: "Gift", enabled: false, icon: envelopeIcon },
];

/** Hidden sizing text — keeps every menu row the same width. */
const SCENE_ACTION_WIDTH_LABEL = "1. Can we switch seats?";

export const SCENE_ACTION_TIMEOUT_SEC = 10;

function initialMenuPlacement(entry) {
  return {
    side: defaultMenuSide(entry),
    vAlign: "center",
    nudge: { x: 0, y: 0 },
  };
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
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPlacement, setMenuPlacement] = useState(() =>
    initialMenuPlacement(entry),
  );

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

  useLayoutEffect(() => {
    if (!isSelected) {
      setMenuPlacement(initialMenuPlacement(entry));
      return;
    }

    const root = rootRef.current;
    const menu = menuRef.current;
    const canvas = root?.closest(".live-canvas-scene");
    if (!root || !menu || !canvas) return;

    const anchorRect = root.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const next = resolveSceneActionMenuPlacement(
      anchorRect,
      { width: menuRect.width, height: menuRect.height },
      canvasRect,
      entry,
    );
    setMenuPlacement(next);
  }, [isSelected, entry]);

  const menuWrapClass = [
    "live-scene-action-menu-wrap",
    MENU_SIDE_CLASS[menuPlacement.side],
    MENU_VALIGN_CLASS[menuPlacement.vAlign],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
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
          ref={menuRef}
          className={menuWrapClass}
          onClick={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div
            className="live-scene-action-menu-nudge"
            style={
              menuPlacement.nudge.x || menuPlacement.nudge.y
                ? {
                    transform: `translate(${menuPlacement.nudge.x}px, ${menuPlacement.nudge.y}px)`,
                  }
                : undefined
            }
          >
            <div className="live-scene-action-menu">
            <SceneActionAvatarPeek
              avatarGrid={entry.member?.activeAvatar?.avatarGrid}
            />
            {SCENE_ACTIONS.map((item) => {
              const itemPending = isPending && item.id === 1;
              const itemDisabled = !item.enabled || itemPending;
              return (
                <div
                  key={item.id}
                  className={`live-scene-action-item-hit${!item.enabled ? " is-disabled" : ""}${itemPending ? " is-pending" : ""}`}
                >
                  <PixelBox
                    as="button"
                    type="button"
                    variant="retro"
                    className={`live-scene-action-item${itemPending ? " is-pending" : ""}${!item.enabled ? " is-disabled" : ""}`}
                    aria-disabled={itemDisabled || undefined}
                    tabIndex={itemDisabled ? -1 : 0}
                    aria-busy={itemPending || undefined}
                    style={
                      itemPending
                        ? {
                            "--scene-action-timeout": `${SCENE_ACTION_TIMEOUT_SEC}s`,
                          }
                        : undefined
                    }
                    onClick={() =>
                      item.enabled && !itemPending && onAction?.(entry, item.id)
                    }
                  >
                    <img
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      className="live-scene-action-icon"
                    />
                    <span className="live-scene-action-text">
                      <span className="live-scene-action-label">
                        {itemPending
                          ? "Pending approval..."
                          : `${item.id}. ${item.label}`}
                      </span>
                      <span className="live-scene-action-size" aria-hidden="true">
                        {SCENE_ACTION_WIDTH_LABEL}
                      </span>
                    </span>
                    {itemPending && (
                      <span
                        className="live-scene-action-progress"
                        aria-hidden="true"
                      >
                        <span className="live-scene-action-progress-fill" />
                      </span>
                    )}
                  </PixelBox>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
