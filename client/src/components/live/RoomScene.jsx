import PlayerAvatar from "./PlayerAvatar";
import {
  CANVAS_REF_H,
  M_APPROX,
  WORLD_SCALE,
  SIDE_MIN_FROM_CENTER,
  BG_SRC,
  BG_HEIGHT_PCT,
  BG_OFFSET_X_REF,
  BG_OFFSET_Y_REF,
  Z_LAYERS,
  assetUrl,
} from "./roomConfig";
import { sideCenterX } from "./liveUtils";

// ── Label 帮手 ──
function Label({ children, bottom = -20 }) {
  return (
    <div
      className="live-canvas-label"
      style={{
        position: "absolute",
        bottom,
        left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        zIndex: Z_LAYERS.label,
      }}
    >
      {children}
    </div>
  );
}

// ── SideSlot：bean_bag / bed / sofa 三种 ──
function SideSlot({ entry, position, canvasW, canvasH, charH }) {
  const { furniture, member } = entry;
  const key = furniture.key;
  const L = furniture.layout ?? {};
  const k = canvasH / CANVAS_REF_H;
  const z = Z_LAYERS[furniture.zSlot] ?? Z_LAYERS["char-back"];

  // 离线角色半透明。undefined 默认作在线（避免首帧 presence 未到时全体闪烁）
  const offlineStyle = member.isOnline === false ? { opacity: 0.35 } : {};

  const cx = sideCenterX(
    position,
    (L.sideInset ?? 260) * k,
    canvasW,
    SIDE_MIN_FROM_CENTER * k,
  );

  const playerAvatar = (clipBottomRows = 0) => (
    <PlayerAvatar
      avatarGrid={member.activeAvatar?.avatarGrid ?? null}
      avatarCuts={member.activeAvatar?.avatarCuts ?? null}
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
          transition: "opacity 0.3s ease",
          ...offlineStyle,
        }}
      >
        <img
          src={assetUrl(furniture.imageKeys?.[0])}
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
          }}
        >
          {playerAvatar()}
        </div>
        <Label>{member.displayName}</Label>
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
          transition: "opacity 0.3s ease",
          ...offlineStyle,
        }}
      >
        <img
          src={assetUrl(furniture.imageKeys?.[0])}
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
          }}
        >
          {playerAvatar()}
        </div>
        <img
          src={assetUrl(furniture.imageKeys?.[1])}
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
        <Label>{member.displayName}</Label>
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
          transition: "opacity 0.3s ease",
          ...offlineStyle,
        }}
      >
        <img
          src={assetUrl(furniture.imageKeys?.[0])}
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
          }}
        >
          {playerAvatar(L.charClipRows)}
        </div>
        <Label>{member.displayName}</Label>
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

  // bg 默认值兑底（demo 模式可能不传 prop）
  const bgSrc = bg?.src ?? BG_SRC;
  const bgHeightPct = bg?.heightPct ?? BG_HEIGHT_PCT;
  const bgOffsetX = bg?.offsetX ?? BG_OFFSET_X_REF;
  const bgOffsetY = bg?.offsetY ?? BG_OFFSET_Y_REF;

  const deskEntries = layout.filter((e) => e.position === "center");
  const leftEntry = layout.find((e) => e.position === "left");
  const rightEntry = layout.find((e) => e.position === "right");
  const deskFurniture = deskEntries[0]?.furniture;
  const deskLayout = deskFurniture?.layout ?? {};
  const deskZ = Z_LAYERS[deskFurniture?.zSlot] ?? Z_LAYERS["char-front"];

  const k = canvasH / CANVAS_REF_H;
  const deskImgBottom = (deskLayout.imgBottom ?? -91) * k;
  const deskImgWidth = (deskLayout.imgWidth ?? 328) * k;
  const deskCharBottom = (deskLayout.charBottom ?? 40) * k;
  const deskCharW = (deskLayout.charWidth ?? 161) * k;
  const halfGap = (deskLayout.charHalfGap ?? 90) * k;
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
                  avatarGrid={entry.member.activeAvatar?.avatarGrid ?? null}
                  avatarCuts={entry.member.activeAvatar?.avatarCuts ?? null}
                  size={charH}
                />
              </div>
            );
          })}

          {/* Desk 图（遮住人） */}
          {deskEntries.length > 0 && deskFurniture && (
            <img
              src={assetUrl(deskFurniture.imageKeys?.[0])}
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

          {/* Desk 名字 label（在桌子下面） */}
          {deskEntries.map((entry) => {
            const centerX = deskCharCenters[entry.slotIndex];
            return (
              <div
                key={`desk-label-${entry.memberIdx}`}
                style={{
                  position: "absolute",
                  left: centerX,
                  bottom: deskImgBottom - 24,
                  transform: "translateX(-50%)",
                  zIndex: deskZ.furniture + 5,
                }}
              >
                <div className="live-canvas-label">
                  {entry.member.displayName}
                </div>
              </div>
            );
          })}

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
