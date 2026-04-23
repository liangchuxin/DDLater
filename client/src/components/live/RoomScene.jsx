import PlayerAvatar from "./PlayerAvatar";
import {
  CANVAS_REF_H,
  M_APPROX,
  WORLD_SCALE,
  SIDE_MIN_FROM_CENTER,
  Z_LAYERS,
  assetUrl,
} from "./roomConfig";
import { sideCenterX } from "./liveUtils";

// ── SideSlot：bean_bag / bed / sofa 三种 ──
function SideSlot({ entry, position, canvasW, canvasH, charH }) {
  const { furniture, member } = entry;
  const key = furniture.key;
  const L = furniture.layout;
  const k = canvasH / CANVAS_REF_H;
  const z = Z_LAYERS[furniture.zSlot];

  // 离线时只让角色半透明,家具保持 opacity 1。
  // 关键: opacity<1 会创建新的 stacking context,如果应用在外层 wrapper 上,
  // 整个 SideSlot (带家具) 会被 z-index=1 的背景图覆盖。所以 offlineStyle
  // 只能应用在包 avatar 的 div 上。undefined 默认作在线。
  const offlineStyle = member.isOnline === false ? { opacity: 0.35 } : {};

  const cx = sideCenterX(
    position,
    L.sideInset * k,
    canvasW,
    SIDE_MIN_FROM_CENTER * k,
  );

  const playerAvatar = (clipBottomRows = 0) => (
    <PlayerAvatar
      avatarGrid={member.activeAvatar?.avatarGrid}
      avatarCuts={member.activeAvatar?.avatarCuts}
      size={charH}
      clipBottomRows={clipBottomRows}
    />
  );

  // ── Bean bag ──
  if (key === "bean_bag") {
    const bagW = L.bagWidth * k;
    const bagH = L.bagHeight * k;
    const bagOffY = L.bagOffsetY * k;
    const charOffX = L.charOffsetX * k;
    const bottom = L.charBottom * k;
    const ctrW = Math.max(bagW, charH);
    const ctrH = charH + bagOffY;
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom,
          width: ctrW,
          height: ctrH,
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
          }}
        />
        <div
          style={{
            position: "absolute",
            left: (ctrW - charH) / 2 + charOffX,
            bottom: bagOffY,
            transform: `rotate(${L.charRotation}deg)`,
            transformOrigin: "bottom center",
            zIndex: z.char,
            transition: "opacity 0.3s ease",
            ...offlineStyle,
          }}
        >
          {playerAvatar()}
        </div>
      </div>
    );
  }

  // ── Bed（双层图层，人夹在中间） ──
  if (key === "bed") {
    const bedW = L.bedWidth * k;
    const bedH = L.bedHeight * k;
    const bedOffY = L.bedOffsetY * k;
    const charW = L.charWidth * k;
    const charOffX = L.charOffsetX * k;
    const bottom = L.bottom * k;
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
          }}
        />
        <div
          style={{
            position: "absolute",
            left: charOffX,
            top: 0,
            width: charW,
            height: charH,
            transform: `rotate(${L.charRotation}deg)`,
            transformOrigin: "center center",
            zIndex: z.char,
            transition: "opacity 0.3s ease",
            ...offlineStyle,
          }}
        >
          {playerAvatar()}
        </div>
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
          }}
        />
      </div>
    );
  }

  // ── Sofa（pixelChar 内部砍腿） ──
  if (key === "sofa") {
    const sofaW = L.sofaWidth * k;
    const sofaH = L.sofaHeight * k;
    const sofaBottom = L.sofaBottom * k;
    const visibleCharH = Math.round(
      (charH * (M_APPROX - L.charClipRows)) / M_APPROX,
    );
    const charBottomInContainer = sofaH - L.charTopInSofa * k;
    const ctrH = charBottomInContainer + visibleCharH;
    const ctrW = Math.max(sofaW, charH);
    return (
      <div
        style={{
          position: "absolute",
          left: cx - ctrW / 2,
          bottom: sofaBottom,
          width: ctrW,
          height: ctrH,
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
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: charBottomInContainer,
            transform: "translateX(-50%)",
            zIndex: z.char,
            transition: "opacity 0.3s ease",
            ...offlineStyle,
          }}
        >
          {playerAvatar(L.charClipRows)}
        </div>
      </div>
    );
  }

  return null;
}

// ── RoomScene 主组件 ──
export default function RoomScene({
  layout,
  canvasW,
  canvasH,
  charH,
  cameraX = 0,
  isDragging = false,
  bg,
}) {
  if (!canvasH) return null;

  const { src: bgSrc, heightPct: bgHeightPct, offsetX: bgOffsetX, offsetY: bgOffsetY } = bg;

  const deskEntries = layout.filter((e) => e.position === "center");
  const leftEntry = layout.find((e) => e.position === "left");
  const rightEntry = layout.find((e) => e.position === "right");
  const deskFurniture = deskEntries[0]?.furniture;
  const deskLayout = deskFurniture?.layout;
  const deskZ = deskFurniture ? Z_LAYERS[deskFurniture.zSlot] : null;

  const k = canvasH / CANVAS_REF_H;
  const deskImgBottom = (deskLayout?.imgBottom ?? 0) * k;
  const deskImgWidth = (deskLayout?.imgWidth ?? 0) * k;
  const deskCharBottom = (deskLayout?.charBottom ?? 0) * k;
  const deskCharW = (deskLayout?.charWidth ?? 0) * k;
  const halfGap = (deskLayout?.charHalfGap ?? 0) * k;
  const deskCharCenters = [
    canvasW / 2 - halfGap, // slot 0 = left seat
    canvasW / 2 + halfGap, // slot 1 = right seat
  ];
  const deskImgLeft = canvasW / 2 - deskImgWidth / 2;

  // World = 比 canvas 更宽的可拖动容器
  const extraEachSide = (canvasW * (WORLD_SCALE - 1)) / 2;
  const worldW = canvasW * WORLD_SCALE;

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
        {/* Background：保持 aspect，相对 world 居中 */}
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
          {/* Desk 角色 */}
          {deskEntries.map((entry) => {
            const centerX = deskCharCenters[entry.slotIndex];
            const offline = entry.member.isOnline === false;
            return (
              <div
                key={`desk-char-${entry.memberIdx}`}
                style={{
                  position: "absolute",
                  left: centerX - deskCharW / 2,
                  bottom: deskCharBottom,
                  width: deskCharW,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: deskZ.char,
                  opacity: offline ? 0.35 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                <PlayerAvatar
                  avatarGrid={entry.member.activeAvatar?.avatarGrid}
                  avatarCuts={entry.member.activeAvatar?.avatarCuts}
                  size={charH}
                />
              </div>
            );
          })}

          {/* Desk 图（遮住人） */}
          {deskEntries.length > 0 && (
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
                zIndex: deskZ.furniture,
              }}
            />
          )}

          {/* Side slot 家具 */}
          {leftEntry && (
            <div style={{ position: "absolute", inset: 0 }}>
              <SideSlot
                entry={leftEntry}
                position="left"
                canvasW={canvasW}
                canvasH={canvasH}
                charH={charH}
              />
            </div>
          )}
          {rightEntry && (
            <div style={{ position: "absolute", inset: 0 }}>
              <SideSlot
                entry={rightEntry}
                position="right"
                canvasW={canvasW}
                canvasH={canvasH}
                charH={charH}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
