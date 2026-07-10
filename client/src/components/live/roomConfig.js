// Scene-level constants. Per-furniture params live in the Furniture.layout backend doc.
// All _REF values are measured in px at CANVAS_REF_W x CANVAS_REF_H; frontend scales
// by k = canvasH / CANVAS_REF_H.

// Canvas / character sizing
export const CANVAS_REF_W = 1435;
export const CANVAS_REF_H = 722;
export const CHAR_REF_H = 235;
export const CHAR_COLS = 26;
// Standard avatar width at reference scale (CHAR_COLS * cell size for M_APPROX rows).
export const CHAR_REF_W = 182;
export const M_APPROX = 30; // pixelChar grid rows (approx; used for sofa leg-clip height estimate)

// Camera: draggable world
export const WORLD_SCALE = 1.6; // world width = canvasW * WORLD_SCALE
export const SIDE_MIN_FROM_CENTER = 460; // min distance from canvas center to side furniture center, in ref units

// Assets
// Furniture images live under client/public/room/. DB imageKeys store filenames; frontend prepends the path.
export const ROOM_ASSETS_PATH = "/room/";
export const assetUrl = (filename) => {
  if (!filename) return "";
  if (/^(https?:|blob:|\/)/.test(filename)) return filename;
  return `${ROOM_ASSETS_PATH}${filename}`;
};

// Background
// Demo/fallback values. Real rooms pull from StudyRoom.background.
export const BG_SRC = "/room/backgrounds/bg-ai-wide.png";
export const BG_HEIGHT_PCT = 200;
export const BG_OFFSET_X_REF = 0; // positive = right
export const BG_OFFSET_Y_REF = -360; // positive = down

// Z-index map
// Backend stores zSlot semantically; frontend translates to concrete z-index.
// Stack order (low -> high): bg -> furniture-back -> char -> furniture-front.
// char-back:   furniture drawn behind the character (bean_bag, sofa)
// char-front:  furniture drawn in front of the character (desk)
// char-middle: character sandwiched between two furniture layers (bed: bottom behind, top in front)
export const Z_LAYERS = {
  bg: 1,
  "char-back": { furniture: 20, char: 25 },
  "char-front": { furniture: 30, char: 20 },
  "char-middle": { bottom: 20, char: 22, top: 24 },
};
