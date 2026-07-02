import PlayerAvatar from "./PlayerAvatar";
import SceneSelectableAvatar from "./SceneSelectableAvatar";
import {
  CANVAS_REF_H,
  CHAR_REF_H,
  CHAR_REF_W,
  M_APPROX,
  WORLD_SCALE,
  SIDE_MIN_FROM_CENTER,
  Z_LAYERS,
  assetUrl,
} from "./roomConfig";
import { sideCenterX } from "./liveUtils";

function renderSelectableChar({
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
  return (
    <SceneSelectableAvatar
      entry={entry}
      selfUserId={selfUserId}
      sceneTargetUserId={sceneTargetUserId}
      scenePendingUserId={scenePendingUserId}
      onSelectTarget={onSelectTarget}
      onAction={onAction}
      onPendingTimeout={onPendingTimeout}
      style={style}
      innerStyle={innerStyle}
    >
      {children}
    </SceneSelectableAvatar>
  );
}

// SideSlot: bean_bag / bed / sofa. centerX + slotBottom = desk slot overrides.
function SideSlot({
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
}) {
  const { furniture, member } = entry;
  const key = furniture.key;
  const L = furniture.layout;
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
      L.sideInset * k,
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

  // Bean bag
  if (key === "bean_bag") {
    const bagW = L.bagWidth * k;
    const bagH = L.bagHeight * k;
    const bagOffY = L.bagOffsetY * k;
    const charOffX = L.charOffsetX * k;
    const bottom = (slotBottom ?? L.charBottom) * k;
    const ctrW = Math.max(bagW, charBoxW);
    const ctrH = charH + bagOffY;
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
          src={assetUrl(furniture.imageKeys[0])}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - bagW) / 2,
            bottom: 0,
            width: bagW,
            height: bagH,
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
            bottom: bagOffY,
            zIndex: z.char,
          },
          innerStyle: {
            transform: `rotate(${L.charRotation}deg)`,
            transformOrigin: "bottom center",
          },
          children: dimAvatar(playerAvatar()),
        })}
      </div>
    );
  }

  // Bed (two image layers sandwiching the character)
  if (key === "bed") {
    const bedW = L.bedWidth * k;
    const bedH = L.bedHeight * k;
    const bedOffY = L.bedOffsetY * k;
    const charW = L.charWidth * k;
    const charOffX = L.charOffsetX * k;
    const bottom = (slotBottom ?? L.bottom) * k;
    const ctrH = bedOffY + bedH;
    const ctrW = Math.max(bedW, charW + charOffX * 2);
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
          src={assetUrl(furniture.imageKeys[0])}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - bedW) / 2,
            bottom: 0,
            width: bedW,
            height: bedH,
            imageRendering: "pixelated",
            zIndex: z.bottom,
            pointerEvents: "none",
          }}
        />
        {renderSelectableChar({
          ...selectionProps,
          style: {
            position: "absolute",
            left: charOffX + (charW - charBoxW) / 2,
            top: (L.charOffsetY ?? 0) * k,
            width: charBoxW,
            height: charH,
            zIndex: z.char,
          },
          innerStyle: {
            width: "100%",
            height: "100%",
            transform: `rotate(${L.charRotation}deg)`,
            transformOrigin: "center center",
          },
          children: dimAvatar(playerAvatar(0, { anchor: "top" })),
        })}
        <img
          src={assetUrl(furniture.imageKeys[1])}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - bedW) / 2,
            bottom: 0,
            width: bedW,
            height: bedH,
            imageRendering: "pixelated",
            zIndex: z.top,
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  // Sofa (pixelChar clips legs internally)
  if (key === "sofa") {
    const sofaW = L.sofaWidth * k;
    const sofaH = L.sofaHeight * k;
    const sofaBottom = (slotBottom ?? L.sofaBottom) * k;
    const visibleCharH =
      (charH * (M_APPROX - L.charClipRows)) / M_APPROX;
    const charBottomInContainer = sofaH - L.charTopInSofa * k;
    const ctrH = charBottomInContainer + visibleCharH;
    const ctrW = Math.max(sofaW, charBoxW);
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom: sofaBottom,
          width: ctrW,
          height: ctrH,
          pointerEvents: "none",
        }}
      >
        <img
          src={assetUrl(furniture.imageKeys[0])}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (ctrW - sofaW) / 2,
            bottom: 0,
            width: sofaW,
            height: sofaH,
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
          children: dimAvatar(playerAvatar(L.charClipRows)),
        })}
      </div>
    );
  }

  return null;
}

function DeskChar({
  entry,
  centerX,
  deskCharW,
  deskCharBottom,
  sceneScale = 1,
  deskZ,
  selfUserId,
  sceneTargetUserId,
  scenePendingUserId,
  onSelectTarget,
  onAction,
  onPendingTimeout,
}) {
  const offline = entry.member.isOnline === false;
  return renderSelectableChar({
    entry,
    selfUserId,
    sceneTargetUserId,
    scenePendingUserId,
    onSelectTarget,
    onAction,
    onPendingTimeout,
    style: {
      position: "absolute",
      left: centerX - deskCharW / 2,
      bottom: deskCharBottom,
      width: deskCharW,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      zIndex: deskZ?.char ?? 3,
    },
    children: (
      <div style={{ opacity: offline ? 0.35 : 1, transition: "opacity 0.3s ease" }}>
        <PlayerAvatar
          avatarGrid={entry.member.activeAvatar?.avatarGrid}
          avatarCuts={entry.member.activeAvatar?.avatarCuts}
          sceneScale={sceneScale}
        />
      </div>
    ),
  });
}

// Main RoomScene component.
export default function RoomScene({
  layout,
  furnitures = [],
  canvasW,
  canvasH,
  sceneScale = 1,
  cameraX = 0,
  isDragging = false,
  bg,
  selfUserId,
  sceneTargetUserId,
  scenePendingUserId,
  onSelectTarget,
  onAction,
  onPendingTimeout,
}) {
  if (!canvasH) return null;

  const charH = CHAR_REF_H * sceneScale;
  const { src: bgSrc, heightPct: bgHeightPct, offsetX: bgOffsetX, offsetY: bgOffsetY } = bg;

  const deskEntries = layout.filter((e) => e.position === "center");
  const useSharedDesk =
    deskEntries.length > 0 &&
    deskEntries.every((e) => e.furniture.key === "desk");
  const sharedDeskEntries = useSharedDesk ? deskEntries : [];
  const soloDeskEntries = useSharedDesk
    ? []
    : deskEntries.filter((e) => e.furniture.key === "desk");
  const centerAltEntries = useSharedDesk
    ? []
    : deskEntries.filter((e) => e.furniture.key !== "desk");
  const leftEntries = layout.filter((e) => e.position === "left");
  const rightEntries = layout.filter((e) => e.position === "right");
  const deskFurniture = furnitures.find((f) => f.key === "desk");
  const deskLayout = deskFurniture?.layout;
  const deskZ = deskFurniture ? Z_LAYERS[deskFurniture.zSlot] : null;

  const k = canvasH / CANVAS_REF_H;
  const deskImgBottom = (deskLayout?.imgBottom ?? 0) * k;
  const deskImgWidth = (deskLayout?.imgWidth ?? 0) * k;
  const deskCharBottom = (deskLayout?.charBottom ?? 0) * k;
  const deskCharW = (deskLayout?.charWidth ?? 0) * k;
  const halfGap = (deskLayout?.charHalfGap ?? 0) * k;
  const deskCharCenters = [
    canvasW / 2 - halfGap,
    canvasW / 2 + halfGap,
  ];
  const deskImgLeft = canvasW / 2 - deskImgWidth / 2;

  const extraEachSide = (canvasW * (WORLD_SCALE - 1)) / 2;
  const worldW = canvasW * WORLD_SCALE;

  const slotProps = {
    selfUserId,
    sceneTargetUserId,
    scenePendingUserId,
    onSelectTarget,
    onAction,
    onPendingTimeout,
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: -extraEachSide,
          top: 0,
          width: worldW,
          height: "100%",
          transform: `translateX(${cameraX}px)`,
          transition: isDragging ? "none" : "transform 0.4s ease",
          willChange: "transform",
        }}
      >
        <img
          src={bgSrc}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            height: `${bgHeightPct}%`,
            width: "auto",
            left: `calc(50% + ${bgOffsetX * k}px)`,
            top: `calc(50% + ${bgOffsetY * k}px)`,
            transform: "translate(-50%, -50%)",
            imageRendering: "pixelated",
            zIndex: Z_LAYERS.bg,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: extraEachSide,
            top: 0,
            width: canvasW,
            height: "100%",
          }}
        >
          {sharedDeskEntries.map((entry) => (
            <DeskChar
              key={`desk-char-${entry.userId}`}
              entry={entry}
              centerX={deskCharCenters[entry.slotIndex]}
              deskCharW={deskCharW}
              deskCharBottom={deskCharBottom}
              sceneScale={sceneScale}
              deskZ={deskZ}
              {...slotProps}
            />
          ))}

          {soloDeskEntries.map((entry) => (
            <DeskChar
              key={`solo-desk-char-${entry.userId}`}
              entry={entry}
              centerX={deskCharCenters[entry.slotIndex]}
              deskCharW={deskCharW}
              deskCharBottom={deskCharBottom}
              sceneScale={sceneScale}
              deskZ={deskZ}
              {...slotProps}
            />
          ))}

          {centerAltEntries.map((entry) => (
            <div key={`center-alt-${entry.userId}`} style={{ position: "absolute", inset: 0 }}>
              <SideSlot
                entry={entry}
                position="left"
                canvasW={canvasW}
                canvasH={canvasH}
                sceneScale={sceneScale}
                centerX={deskCharCenters[entry.slotIndex]}
                slotBottom={deskCharBottom / k}
                {...slotProps}
              />
            </div>
          ))}

          {useSharedDesk && deskFurniture && (
            <img
              src={assetUrl(deskFurniture.imageKeys[0])}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: deskImgLeft,
                bottom: deskImgBottom,
                width: deskImgWidth,
                height: "auto",
                imageRendering: "pixelated",
                zIndex: deskZ?.furniture ?? 4,
                pointerEvents: "none",
              }}
            />
          )}

          {leftEntries.map((entry) => (
            <div key={`left-${entry.userId}`} style={{ position: "absolute", inset: 0 }}>
              <SideSlot
                entry={entry}
                position="left"
                canvasW={canvasW}
                canvasH={canvasH}
                sceneScale={sceneScale}
                {...slotProps}
              />
            </div>
          ))}
          {rightEntries.map((entry) => (
            <div key={`right-${entry.userId}`} style={{ position: "absolute", inset: 0 }}>
              <SideSlot
                entry={entry}
                position="right"
                canvasW={canvasW}
                canvasH={canvasH}
                sceneScale={sceneScale}
                {...slotProps}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
