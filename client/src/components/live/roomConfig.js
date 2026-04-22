// 场景级常数。per-furniture 参数在后端 Furniture.layout 里。
// 所有 _REF 值都是 @ CANVAS_REF_W × CANVAS_REF_H 下测量的 px，前端按 k = canvasH/CANVAS_REF_H 缩放。

// ── Canvas / character sizing ──
export const CANVAS_REF_W = 1435;
export const CANVAS_REF_H = 722;
export const CHAR_REF_H = 235;
export const M_APPROX = 30; // pixelChar grid rows (近似值，用于沙发裁腿可见高度估算)

// ── Camera: draggable world ──
export const WORLD_SCALE = 1.6; // world 宽度 = canvasW × WORLD_SCALE
export const SIDE_MIN_FROM_CENTER = 460; // side 家具中心距 canvas 中心最小距离 @ ref

// ── Assets ──
// 家具图片存在 client/public/room/ 下。数据库的 imageKeys 存文件名，前端拼路径。
export const ROOM_ASSETS_PATH = "/room/";
export const assetUrl = (filename) =>
  filename ? `${ROOM_ASSETS_PATH}${filename}` : null;

// ── Background ──
// 这些只是 demo/fallback 值。真实 room 从 StudyRoom.background 读。
export const BG_SRC = "/room/backgrounds/bg-ai-wide.png";
export const BG_HEIGHT_PCT = 200;
export const BG_OFFSET_X_REF = 0; // 正数向右
export const BG_OFFSET_Y_REF = -360; // 正数向下

// ── Z-index 映射 ──
// 后端存 zSlot 语义，前端翻译成具体 z-index 数值。
// 层级从低到高：bg → furniture-back → char → furniture-front
// char-back:   家具图在人后（bean_bag、sofa）
// char-front:  家具图在人前（desk）
// char-middle: 两层家具夹着人（bed: bottom 在后、top 在前）
export const Z_LAYERS = {
  bg: 1,
  "char-back": { furniture: 20, char: 25 },
  "char-front": { furniture: 30, char: 20 },
  "char-middle": { bottom: 20, char: 22, top: 24 },
};
