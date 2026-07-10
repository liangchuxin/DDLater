import PlayerAvatar from "../PlayerAvatar";
import {
  CANVAS_REF_H,
  CHAR_REF_H,
  CHAR_REF_W,
  M_APPROX,
  SIDE_MIN_FROM_CENTER,
  Z_LAYERS,
  assetUrl,
} from "../roomConfig";
import { sideCenterX } from "../liveUtils";
import { normalizeFurnitureLayout } from "./normalizeFurnitureLayout";
import { resolveSideRenderMode } from "./furnitureTemplates";

export default function SideFurnitureSlot({
  entry,
  position,
  canvasW,
  canvasH,
  sceneScale = 1,
  centerX,
  slotBottom,
  selfUserId,
  sceneTargetUserId,
  scenePendingUserId,
  onSelectTarget,
  onAction,
  onPendingTimeout,
  renderSelectableChar,
}) {
  const { furniture, member } = entry;
  const mode = resolveSideRenderMode(furniture);
  if (!mode) return null;

  const L = normalizeFurnitureLayout(furniture);
  const k = canvasH / CANVAS_REF_H;
  const charH = CHAR_REF_H * sceneScale;
  const charBoxW = CHAR_REF_W * sceneScale;
  const z = Z_LAYERS[furniture.zSlot];

  const offlineStyle = member.isOnline === false ? { opacity: 0.35 } : {};
  const dimAvatar = (node) => (
    <div style={{ transition: "opacity 0.3s ease", ...offlineStyle }}>{node}</div>
  );

  const cx =
    centerX ??
    sideCenterX(
      position,
      (L.sideInset ?? 260) * k,
      canvasW,
      SIDE_MIN_FROM_CENTER * k,
    );

  const playerAvatar = (clipBottomRows = 0, { anchor = "bottom" } = {}) => (
    <PlayerAvatar
      avatarGrid={member.activeAvatar?.avatarGrid}
      avatarCuts={member.activeAvatar?.avatarCuts}
      sceneScale={sceneScale}
      clipBottomRows={clipBottomRows}
      anchor={anchor}
    />
  );

  const selectionProps = {
    entry,
    selfUserId,
    sceneTargetUserId,
    scenePendingUserId,
    onSelectTarget,
    onAction,
    onPendingTimeout,
  };

  const imgSrc = (index) => {
    const key = furniture.imageKeys[index] ?? "";
    const base = assetUrl(key);
    const v = furniture._assetV;
    if (!base || !v) return base;
    return `${base}?v=${v}`;
  };

  if (mode === "side-char-back") {
    const fw = (L.furnitureW ?? 220) * k;
    const fh = (L.furnitureH ?? 160) * k;
    const lift = (L.furnitureLiftY ?? 20) * k;
    const charOffX = (L.charOffsetX ?? 0) * k;
    const bottom = (slotBottom ?? L.bottom ?? 0) * k;
    const clipRows = L.charClipRows ?? 0;
    const align = L.charAlign ?? "offset";

    if (align === "center") {
      const charTopIn = (L.charTopInFurniture ?? fh / k) * k;
      const visibleCharH =
        clipRows > 0 ? (charH * (M_APPROX - clipRows)) / M_APPROX : charH;
      const charBottomInContainer = fh - charTopIn;
      const ctrH = charBottomInContainer + visibleCharH;
      const ctrW = Math.max(fw, charBoxW);
      return (
        <div
          style={{
            position: "absolute",
            left: cx - ctrW / 2,
            bottom,
            width: ctrW,
            height: ctrH,
            pointerEvents: "none",
          }}
        >
          <img
            src={imgSrc(0)}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: (ctrW - fw) / 2,
              bottom: 0,
              width: fw,
              height: fh,
              imageRendering: "pixelated",
              zIndex: z.furniture,
              objectFit: "fill",
              pointerEvents: "none",
            }}
          />
          {renderSelectableChar({
            ...selectionProps,
            style: {
              position: "absolute",
              left: "50%",
              bottom: charBottomInContainer,
              transform: "translateX(-50%)",
              zIndex: z.char,
            },
            children: dimAvatar(playerAvatar(clipRows)),
          })}
        </div>
      );
    }

    const ctrW = Math.max(fw, charBoxW);
    const ctrH = charH + lift;
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom,
          width: ctrW,
          height: ctrH,
          pointerEvents: "none",
        }}
      >
        <img
          src={imgSrc(0)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - fw) / 2,
            bottom: 0,
            width: fw,
            height: fh,
            imageRendering: "pixelated",
            zIndex: z.furniture,
            pointerEvents: "none",
          }}
        />
        {renderSelectableChar({
          ...selectionProps,
          style: {
            position: "absolute",
            left: (ctrW - charBoxW) / 2 + charOffX,
            bottom: lift,
            zIndex: z.char,
          },
          innerStyle: {
            transform: `rotate(${L.charRotation ?? 0}deg)`,
            transformOrigin: "bottom center",
          },
          children: dimAvatar(playerAvatar(clipRows)),
        })}
      </div>
    );
  }

  if (mode === "side-char-front") {
    const fw = (L.furnitureW ?? 220) * k;
    const fh = (L.furnitureH ?? 160) * k;
    const charOffX = (L.charOffsetX ?? 0) * k;
    const charOffY = (L.charOffsetY ?? 0) * k;
    const bottom = (slotBottom ?? L.bottom ?? 0) * k;
    const ctrW = Math.max(fw, charBoxW);
    const ctrH = Math.max(fh, charH + charOffY);
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom,
          width: ctrW,
          height: ctrH,
          pointerEvents: "none",
        }}
      >
        {renderSelectableChar({
          ...selectionProps,
          style: {
            position: "absolute",
            left: (ctrW - charBoxW) / 2 + charOffX,
            bottom: charOffY,
            zIndex: z.char,
          },
          innerStyle: {
            transform: `rotate(${L.charRotation ?? 0}deg)`,
            transformOrigin: "bottom center",
          },
          children: dimAvatar(playerAvatar()),
        })}
        <img
          src={imgSrc(0)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - fw) / 2,
            bottom: 0,
            width: fw,
            height: fh,
            imageRendering: "pixelated",
            zIndex: z.furniture,
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  if (mode === "side-sandwich") {
    const fw = (L.furnitureW ?? 320) * k;
    const fh = (L.furnitureH ?? 255) * k;
    const lift = (L.furnitureLiftY ?? 100) * k;
    const charOffX = (L.charOffsetX ?? 0) * k;
    const charSlotW = (L.charSlotW ?? 165) * k;
    const bottom = (slotBottom ?? L.bottom ?? 0) * k;
    const ctrH = lift + fh;
    const ctrW = Math.max(fw, charSlotW + charOffX * 2);
    const anchor = L.charAnchor ?? "top";
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom,
          width: ctrW,
          height: ctrH,
          pointerEvents: "none",
        }}
      >
        <img
          src={imgSrc(0)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - fw) / 2,
            bottom: 0,
            width: fw,
            height: fh,
            imageRendering: "pixelated",
            zIndex: z.bottom,
            pointerEvents: "none",
          }}
        />
        {renderSelectableChar({
          ...selectionProps,
          style: {
            position: "absolute",
            left: charOffX + (charSlotW - charBoxW) / 2,
            ...(anchor === "top"
              ? { top: (L.charOffsetY ?? 0) * k }
              : { bottom: lift + (L.charOffsetY ?? 0) * k }),
            width: charBoxW,
            height: charH,
            zIndex: z.char,
          },
          innerStyle: {
            width: "100%",
            height: "100%",
            transform: `rotate(${L.charRotation ?? 0}deg)`,
            transformOrigin: "center center",
          },
          children: dimAvatar(playerAvatar(0, { anchor })),
        })}
        <img
          src={imgSrc(1)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - fw) / 2,
            bottom: 0,
            width: fw,
            height: fh,
            imageRendering: "pixelated",
            zIndex: z.top,
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  return null;
}
