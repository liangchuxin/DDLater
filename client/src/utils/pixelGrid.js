/** Pure helpers for avatar pixel grids (hex strings or null = transparent). */

import { compositeEditorLayout } from "./pixelChar.js";

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

/** Target size for edit canvas: at least reference size + room for bottom guide line. */
export function editGridTargetSize(editGrid, referenceGrid) {
  const editRows = editGrid?.length ?? 0;
  const editCols = editGrid?.[0]?.length ?? 0;
  const refRows = referenceGrid?.length ?? 0;
  const refCols = referenceGrid?.[0]?.length ?? 0;
  const rulerRows = refRows || editRows;
  const rulerCols = refCols || editCols;
  return {
    rows: Math.max(editRows, rulerRows),
    cols: Math.max(editCols, rulerCols),
    rulerRows,
    rulerCols,
  };
}

/** Extend grid with transparent cells on the bottom/right. */
export function padGridToSize(grid, rows, cols) {
  if (!grid?.length) return grid;
  const curRows = grid.length;
  const curCols = grid[0]?.length ?? 0;
  if (curRows >= rows && curCols >= cols) return grid;
  const targetRows = Math.max(curRows, rows);
  const targetCols = Math.max(curCols, cols);
  return Array.from({ length: targetRows }, (_, r) =>
    Array.from({ length: targetCols }, (_, c) => grid[r]?.[c] ?? null),
  );
}

export function normalizeRect(r0, c0, r1, c1) {
  return {
    r0: Math.min(r0, r1),
    c0: Math.min(c0, c1),
    r1: Math.max(r0, r1),
    c1: Math.max(c0, c1),
  };
}

export function translateRect(rect, deltaR, deltaC) {
  return {
    r0: rect.r0 + deltaR,
    c0: rect.c0 + deltaC,
    r1: rect.r1 + deltaR,
    c1: rect.c1 + deltaC,
  };
}

export function copyGridCell(grid, fromR, fromC, toR, toC) {
  const next = cloneGrid(grid);
  next[toR][toC] = grid[fromR]?.[fromC] ?? null;
  return next;
}

/** Move a rectangular region; source cells become transparent. */
export function moveGridRegion(grid, rect, deltaR, deltaC) {
  deltaR = Math.round(deltaR);
  deltaC = Math.round(deltaC);
  if (!deltaR && !deltaC) return grid;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return grid;

  const box = normalizeRect(rect.r0, rect.c0, rect.r1, rect.c1);
  const safe = {
    r0: Math.max(0, box.r0),
    c0: Math.max(0, box.c0),
    r1: Math.min(rows - 1, box.r1),
    c1: Math.min(cols - 1, box.c1),
  };
  if (safe.r0 > safe.r1 || safe.c0 > safe.c1) return grid;

  const next = cloneGrid(grid);
  const chunk = [];
  for (let r = safe.r0; r <= safe.r1; r++) {
    const row = [];
    for (let c = safe.c0; c <= safe.c1; c++) {
      row.push(grid[r][c]);
      next[r][c] = null;
    }
    chunk.push(row);
  }

  for (let r = 0; r < chunk.length; r++) {
    for (let c = 0; c < chunk[r].length; c++) {
      const nr = safe.r0 + r + deltaR;
      const nc = safe.c0 + c + deltaC;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        next[nr][nc] = chunk[r][c];
      }
    }
  }
  return next;
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
  const point = gridPointFromPointer(canvas, grid, clientX, clientY);
  if (!point) return null;
  return { row: point.cellRow, col: point.cellCol };
}

/** Sub-cell pointer position for smooth brush dragging. */
export function gridPointFromPointer(canvas, grid, clientX, clientY) {
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
  const col = x / cellW;
  const row = y / cellH;

  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return { row, col, cellRow: Math.floor(row), cellCol: Math.floor(col) };
}

/** CSS-pixel cell size; matches pointer mapping on the displayed canvas. */
export function canvasGridMetrics(canvas, grid) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || !grid?.length) return null;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return null;

  return {
    rect,
    rows,
    cols,
    cellW: rect.width / cols,
    cellH: rect.height / rows,
  };
}

export function brushOverlayFromPointer(canvas, grid, clientX, clientY, radiusCells) {
  const m = canvasGridMetrics(canvas, grid);
  if (!m) return null;

  return {
    x: clientX - m.rect.left,
    y: clientY - m.rect.top,
    radiusX: radiusCells * m.cellW,
    radiusY: radiusCells * m.cellH,
    radiusCells,
  };
}

function compositeCanvasMetrics(canvas, editGrid, referenceGrid, showReference) {
  const layout = compositeEditorLayout(editGrid, referenceGrid, showReference);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || !layout.editRows) return null;

  const { totalCols, totalRows, editRows, editCols } = layout;
  return {
    ...layout,
    rect,
    scaleX: canvas.width / rect.width,
    scaleY: canvas.height / rect.height,
    cellW: canvas.width / totalCols,
    cellH: canvas.height / totalRows,
    editLayerW: (editCols / totalCols) * rect.width,
    editLayerH: rect.height,
  };
}

/** Pointer → edit grid cell; ignores the reference ghost on the right. */
export function gridPointFromEditPointer(
  canvas,
  editGrid,
  referenceGrid,
  showReference,
  clientX,
  clientY,
) {
  const m = compositeCanvasMetrics(canvas, editGrid, referenceGrid, showReference);
  if (!m) return null;

  const x = (clientX - m.rect.left) * m.scaleX;
  const y = (clientY - m.rect.top) * m.scaleY;
  const col = x / m.cellW;
  const row = y / m.cellH;

  if (row < 0 || row >= m.editRows || col < 0 || col >= m.editCols) return null;
  return { row, col, cellRow: Math.floor(row), cellCol: Math.floor(col) };
}

export function gridCellFromEditPointer(
  canvas,
  editGrid,
  referenceGrid,
  showReference,
  clientX,
  clientY,
) {
  const point = gridPointFromEditPointer(
    canvas,
    editGrid,
    referenceGrid,
    showReference,
    clientX,
    clientY,
  );
  if (!point) return null;
  return { row: point.cellRow, col: point.cellCol };
}

export function brushOverlayFromEditPointer(
  canvas,
  editGrid,
  referenceGrid,
  showReference,
  clientX,
  clientY,
  radiusCells,
) {
  const m = compositeCanvasMetrics(canvas, editGrid, referenceGrid, showReference);
  if (!m) return null;

  const xCss = clientX - m.rect.left;
  const yCss = clientY - m.rect.top;
  const col = (xCss / m.rect.width) * m.totalCols;
  const row = (yCss / m.rect.height) * m.totalRows;
  if (col < 0 || col >= m.editCols || row < 0 || row >= m.editRows) return null;

  const cellW = m.editLayerW / m.editCols;
  const cellH = m.editLayerH / m.editRows;
  return {
    x: (col / m.editCols) * m.editLayerW,
    y: (row / m.editRows) * m.editLayerH,
    radiusX: radiusCells * cellW,
    radiusY: radiusCells * cellH,
    radiusCells,
  };
}
