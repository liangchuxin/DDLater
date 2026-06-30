/** Pure helpers for avatar pixel grids (hex strings or null = transparent). */

export function normalizeHex(color) {
  if (!color || typeof color !== "string") return null;
  const raw = color.trim();
  if (raw === "transparent") return null;
  const m = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${hex}`;
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function setGridPixel(grid, row, col, color) {
  if (color === null) {
    const next = cloneGrid(grid);
    next[row][col] = null;
    return next;
  }
  const hex = normalizeHex(color);
  if (!hex) return grid;
  const next = cloneGrid(grid);
  next[row][col] = hex;
  return next;
}

export function gridCellFromPointer(canvas, grid, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return null;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  const col = Math.floor(x / cellW);
  const row = Math.floor(y / cellH);

  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return { row, col };
}
