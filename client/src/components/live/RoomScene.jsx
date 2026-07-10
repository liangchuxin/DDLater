import PlayerAvatar from "./PlayerAvatar";
import SceneSelectableAvatar from "./SceneSelectableAvatar";
import {
  CANVAS_REF_H,
  CHAR_REF_H,
  CHAR_REF_W,
  WORLD_SCALE,
  Z_LAYERS,
  assetUrl,
} from "./roomConfig";
import { normalizeDeskLayout } from "./furniture/normalizeDeskLayout";
import SideFurnitureSlot from "./furniture/SideFurnitureSlot";
import { deriveFurnitureSpec, resolveSideRenderMode } from "./furniture/furnitureTemplates";

function isCenterFurniture(furniture) {
  return deriveFurnitureSpec(furniture)?.slotType === "center";
}

function groupCenterEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.furniture.key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

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

// SideSlot: side furniture via template renderer (legacy keys mapped in normalizeFurnitureLayout).
function SideSlot(props) {
  const { entry } = props;
  if (!resolveSideRenderMode(entry.furniture)) return null;
  return (
    <SideFurnitureSlot
      {...props}
      renderSelectableChar={renderSelectableChar}
    />
  );
}

function DeskChar({
  entry,
  centerX,
  charBottom,
  charWidth,
  charRotation = 0,
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
      left: centerX - charWidth / 2,
      bottom: charBottom,
      width: charWidth,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      zIndex: deskZ?.char ?? 3,
    },
    innerStyle: {
      transform: `rotate(${charRotation}deg)`,
      transformOrigin: "bottom center",
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

  const centerEntries = layout.filter((e) => e.position === "center");
  const centerGroups = groupCenterEntries(centerEntries);
  const leftEntries = layout.filter((e) => e.position === "left");
  const rightEntries = layout.filter((e) => e.position === "right");

  const k = canvasH / CANVAS_REF_H;

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
          {Array.from(centerGroups.entries()).map(([furnitureKey, entries]) => {
            const furniture = entries[0]?.furniture;
            if (!furniture || !isCenterFurniture(furniture)) return null;

            const layoutNorm = normalizeDeskLayout(
              furniture.layout,
              furniture.capacity ?? 2,
            );
            const centerZ = Z_LAYERS[furniture.zSlot];
            const halfGap = layoutNorm.charHalfGap * k;
            const centerCharCenters = [
              canvasW / 2 - halfGap,
              canvasW / 2 + halfGap,
            ];
            const centerImgBottom = layoutNorm.imgBottom * k;
            const centerImgWidth = layoutNorm.imgWidth * k;
            const centerImgLeft = canvasW / 2 - centerImgWidth / 2;

            const centerCharProps = (entry) => {
              const seat =
                layoutNorm.seats[entry.slotIndex] ?? layoutNorm.seats[0];
              return {
                centerX: centerCharCenters[entry.slotIndex] + seat.charOffsetX * k,
                charBottom: layoutNorm.charBottom * k + seat.charOffsetY * k,
                charWidth: seat.charWidth * k,
                charRotation: seat.charRotation ?? 0,
              };
            };

            return (
              <div key={`center-group-${furnitureKey}`}>
                {entries.map((entry) => (
                  <DeskChar
                    key={`center-char-${entry.userId}`}
                    entry={entry}
                    {...centerCharProps(entry)}
                    sceneScale={sceneScale}
                    deskZ={centerZ}
                    {...slotProps}
                  />
                ))}
                {furniture.imageKeys?.[0] && (
                  <img
                    src={
                      furniture._assetV
                        ? `${assetUrl(furniture.imageKeys[0])}?v=${furniture._assetV}`
                        : assetUrl(furniture.imageKeys[0])
                    }
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: centerImgLeft,
                      bottom: centerImgBottom,
                      width: centerImgWidth,
                      height: "auto",
                      imageRendering: "pixelated",
                      zIndex: centerZ?.furniture ?? 4,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            );
          })}

          {centerEntries
            .filter((entry) => !isCenterFurniture(entry.furniture))
            .map((entry) => (
              <div
                key={`center-side-${entry.userId}`}
                style={{ position: "absolute", inset: 0 }}
              >
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
