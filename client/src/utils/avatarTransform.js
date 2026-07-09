/** Grid-level avatar transforms (portable across any avatar with matching cols). */

export const TRANSFORM_VERSION = 1;
export const STORAGE_KEY = "ddlater-transform-templates";

export function gridRows(grid) {
  return grid?.length ?? 0;
}

export function gridCols(grid) {
  return grid?.[0]?.length ?? 0;
}

export function createIdentitySampleMap(rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => [r, c]),
  );
}

export const ERASED_SAMPLE = [-1, -1, -1];
export const ERASED_CELL = [-1, -1];

export function cloneSampleMap(map) {
  if (!map?.length) return map ?? [];
  return map.map((row) =>
    row.map((cell) =>
      Array.isArray(cell) ? [...cell] : [...ERASED_CELL],
    ),
  );
}

export function cloneCompositeSampleMap(map) {
  return normalizeCompositeMap(map);
}

/** Place dual characters back-to-back with no empty gap column. */
export function compactDualSlotOffsets(slots) {
  if (slots.length < 2) return slots;
  let x = 0;
  return slots.map((slot) => {
    const cols = slot.sampleMap?.[0]?.length || slot.cols || 26;
    const next = { ...slot, offsetX: x, offsetY: slot.offsetY || 0 };
    x += cols;
    return next;
  });
}

/** Normalize dual template: compact offsets + unified composite map. */
export function prepareDualTemplate(template) {
  if (!template?.slots?.length || template.slots.length < 2) return template;
  const slots = compactDualSlotOffsets(
    template.slots.map((s) => ({
      ...s,
      sampleMap: s.sampleMap?.length ? cloneSampleMap(s.sampleMap) : s.sampleMap,
    })),
  );
  const compositeSampleMap = template.compositeSampleMap?.length
    ? normalizeCompositeMap(cloneCompositeSampleMap(template.compositeSampleMap))
    : normalizeCompositeMap(mergeSlotsToCompositeMap(slots));
  return { ...template, slots, compositeSampleMap };
}

export function compositeMapSize(slots) {
  let maxW = 0;
  let maxH = 0;
  for (const slot of slots) {
    const rows = slot.sampleMap?.length || slot.rows || 0;
    const cols = slot.sampleMap?.[0]?.length || slot.cols || 0;
    maxW = Math.max(maxW, slot.offsetX + cols);
    maxH = Math.max(maxH, slot.offsetY + rows);
  }
  return { rows: maxH, cols: maxW };
}

/** Merge per-slot maps into one unified canvas map: [slotIndex, sourceRow, sourceCol]. */
export function mergeSlotsToCompositeMap(slots) {
  const { rows, cols } = compositeMapSize(slots);
  const map = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [...ERASED_SAMPLE]),
  );

  slots.forEach((slot, slotIndex) => {
    const sampleMap = slot.sampleMap;
    if (!sampleMap?.length) return;
    for (let r = 0; r < sampleMap.length; r++) {
      for (let c = 0; c < (sampleMap[0]?.length ?? 0); c++) {
        const cell = sampleMap[r][c];
        if (!Array.isArray(cell) || cell.length < 2) continue;
        const [sr, sc] = cell;
        const cr = slot.offsetY + r;
        const cc = slot.offsetX + c;
        if (cr >= rows || cc >= cols) continue;
        map[cr][cc] =
          sr < 0 || sc < 0 ? [...ERASED_SAMPLE] : [slotIndex, sr, sc];
      }
    }
  });

  return map;
}

/** Ensure every cell is a valid [slotIndex, sourceRow, sourceCol] triplet. */
export function normalizeCompositeMap(map) {
  if (!map?.length) return [];
  const rows = map.length;
  const cols = Math.max(
    0,
    ...map.map((row) => (Array.isArray(row) ? row.length : 0)),
  );
  return Array.from({ length: rows }, (_, r) => {
    const row = map[r];
    const cells = Array.isArray(row) ? row : [];
    return Array.from({ length: cols }, (_, c) => {
      const cell = cells[c];
      if (!Array.isArray(cell) || cell.length < 3) return [...ERASED_SAMPLE];
      const si = cell[0] | 0;
      const sr = cell[1] | 0;
      const sc = cell[2] | 0;
      if (si < 0 || sr < 0 || sc < 0) return [...ERASED_SAMPLE];
      return [si, sr, sc];
    });
  });
}

/** Split unified canvas map back into per-slot sample maps for export. */
export function splitCompositeMapToSlots(compositeMap, slots) {
  return slots.map((slot, slotIndex) => {
    const rows = slot.sampleMap?.length || slot.rows || 0;
    const cols = slot.sampleMap?.[0]?.length || slot.cols || 0;
    const sampleMap = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const cr = slot.offsetY + r;
        const cc = slot.offsetX + c;
        const cell = compositeMap[cr]?.[cc];
        if (!Array.isArray(cell) || cell.length < 3) return [...ERASED_CELL];
        const [si, sr, sc] = cell;
        if (si !== slotIndex || sr < 0 || sc < 0) return [...ERASED_CELL];
        return [sr, sc];
      }),
    );
    return { ...slot, sampleMap, rows, cols };
  });
}

/** Sync slot sample maps from composite (call on save/export only). */
export function templateWithSyncedSlots(template) {
  if (template.slots.length < 2 || !template.compositeSampleMap?.length) {
    return template;
  }
  return {
    ...template,
    slots: splitCompositeMapToSlots(template.compositeSampleMap, template.slots),
  };
}

function slotSourceDims(slots, slotIndex) {
  const slot = slots[slotIndex];
  return {
    rows: slot?.sampleMap?.length || slot?.rows || 1,
    cols: slot?.sampleMap?.[0]?.length || slot?.cols || 1,
  };
}

/** Render unified map with per-slot avatar grids. */
export function applyCompositeSampleMap(compositeMap, avatarGrids) {
  if (!compositeMap?.length) return [];
  const rows = compositeMap.length;
  const cols = Math.max(
    0,
    ...compositeMap.map((row) => (Array.isArray(row) ? row.length : 0)),
  );
  return Array.from({ length: rows }, (_, r) => {
    const row = compositeMap[r];
    const cells = Array.isArray(row) ? row : [];
    return Array.from({ length: cols }, (_, c) => {
      const cell = cells[c];
      if (!Array.isArray(cell) || cell.length < 3) return null;
      const slotIndex = cell[0] | 0;
      const sr = cell[1] | 0;
      const sc = cell[2] | 0;
      if (slotIndex < 0 || sr < 0 || sc < 0) return null;
      const grid = avatarGrids?.[slotIndex];
      if (!grid?.length || sr >= grid.length || sc >= (grid[0]?.length ?? 0)) {
        return null;
      }
      return grid[sr][sc] ?? null;
    });
  });
}

export function resetCompositeSampleMap(slots) {
  return mergeSlotsToCompositeMap(
    slots.map((slot) => ({
      ...slot,
      sampleMap: resetSampleMap(
        slot.sampleMap?.length || slot.rows || 0,
        slot.sampleMap?.[0]?.length || slot.cols || 26,
      ),
    })),
  );
}

export function unifiedClearSampleCell(compositeMap, row, col) {
  const next = cloneCompositeSampleMap(compositeMap);
  if (row >= 0 && row < next.length && col >= 0 && col < (next[0]?.length ?? 0)) {
    next[row][col] = [...ERASED_SAMPLE];
  }
  return next;
}

export function unifiedCopySampleCell(compositeMap, fromR, fromC, toR, toC) {
  const map = normalizeCompositeMap(compositeMap);
  fromR |= 0;
  fromC |= 0;
  toR |= 0;
  toC |= 0;
  const cols = map[0]?.length ?? 0;
  if (
    fromR < 0 ||
    fromC < 0 ||
    toR < 0 ||
    toC < 0 ||
    fromR >= map.length ||
    toR >= map.length ||
    fromC >= cols ||
    toC >= cols
  ) {
    return map;
  }

  const src = map[fromR][fromC];
  if (!Array.isArray(src) || src.length < 3) return map;

  const next = cloneCompositeSampleMap(map);
  next[toR][toC] = [src[0] | 0, src[1] | 0, src[2] | 0];
  return next;
}

/** Liquefy on unified composite map — source coords clamped per slot avatar. */
export function unifiedLiquefyStroke(
  compositeMap,
  slots,
  centerR,
  centerC,
  deltaR,
  deltaC,
  radius,
) {
  if (!radius || (!deltaR && !deltaC)) return compositeMap;
  const map = normalizeCompositeMap(compositeMap);
  const next = cloneCompositeSampleMap(map);
  const rows = map.length;
  const cols = map[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    const row = map[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < cols; c++) {
      const dist = Math.hypot(r - centerR, c - centerC);
      if (dist > radius) continue;
      const t = 1 - dist / radius;
      const cell = row[c];
      if (!Array.isArray(cell) || cell.length < 3) continue;
      const si = cell[0] | 0;
      const sr = cell[1] | 0;
      const sc = cell[2] | 0;
      if (si < 0 || sr < 0 || sc < 0) continue;
      const { rows: maxR, cols: maxC } = slotSourceDims(slots, si);
      next[r][c] = [
        si,
        clamp(Math.round(sr - deltaR * t), 0, maxR - 1),
        clamp(Math.round(sc - deltaC * t), 0, maxC - 1),
      ];
    }
  }
  return next;
}

/** Soft drag on unified composite map — pulls cell assignments across the full canvas. */
export function unifiedDragStroke(
  compositeMap,
  _slots,
  centerR,
  centerC,
  deltaR,
  deltaC,
  radius,
  strength = 0.75,
) {
  if (!radius || (!deltaR && !deltaC)) return compositeMap;
  const map = normalizeCompositeMap(compositeMap);
  const next = cloneCompositeSampleMap(map);
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const r0 = Math.max(0, Math.floor(centerR - radius));
  const r1 = Math.min(rows - 1, Math.ceil(centerR + radius));
  const c0 = Math.max(0, Math.floor(centerC - radius));
  const c1 = Math.min(cols - 1, Math.ceil(centerC + radius));

  for (let r = r0; r <= r1; r++) {
    const row = map[r];
    if (!Array.isArray(row)) continue;
    for (let c = c0; c <= c1; c++) {
      const dist = Math.hypot(r - centerR, c - centerC);
      const t = doughFalloff(dist, radius);
      if (!t) continue;
      const stepR = dragStep(deltaR, t, strength);
      const stepC = dragStep(deltaC, t, strength);
      if (!stepR && !stepC) continue;

      const fr = r - stepR;
      const fc = c - stepC;
      if (fr < 0 || fc < 0 || fr >= rows || fc >= cols) continue;
      const srcRow = map[fr];
      const src = srcRow?.[fc];
      if (!Array.isArray(src) || src.length < 3 || src[0] < 0 || src[1] < 0 || src[2] < 0) {
        continue;
      }
      next[r][c] = [src[0] | 0, src[1] | 0, src[2] | 0];
    }
  }
  return next;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Apply sample map: output[r,c] = grid[sr,sc] or null if out of bounds / erased. */
export function applySampleMap(grid, sampleMap) {
  if (!grid?.length || !sampleMap?.length) return [];
  const srcRows = grid.length;
  const srcCols = grid[0]?.length ?? 0;
  return sampleMap.map((row, r) =>
    row.map(([sr, sc]) => {
      if (sr < 0 || sc < 0 || sr >= srcRows || sc >= srcCols) return null;
      return grid[sr][sc] ?? null;
    }),
  );
}

/** Liquefy brush: shift source coordinates inside a circular falloff. */
export function liquefyStroke(sampleMap, centerR, centerC, deltaR, deltaC, radius) {
  if (!radius || (!deltaR && !deltaC)) return sampleMap;
  const next = cloneSampleMap(sampleMap);
  const rows = sampleMap.length;
  const cols = sampleMap[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist = Math.hypot(r - centerR, c - centerC);
      if (dist > radius) continue;
      const t = 1 - dist / radius;
      const [sr, sc] = sampleMap[r][c];
      if (sr < 0 || sc < 0) continue;
      next[r][c] = [
        clamp(Math.round(sr - deltaR * t), 0, rows - 1),
        clamp(Math.round(sc - deltaC * t), 0, cols - 1),
      ];
    }
  }
  return next;
}

function doughFalloff(dist, radius) {
  if (dist >= radius) return 0;
  const u = 1 - dist / radius;
  // Smoothstep: exactly 0 at the outer edge (matches the ring), softer than liquefy in the middle.
  return u * u * (3 - 2 * u);
}

function dragStep(delta, t, strength) {
  if (!delta || t <= 0) return 0;
  const w = delta * t * strength;
  if (Math.abs(w) < 0.08) return 0;
  if (Math.abs(w) >= 0.5) return Math.round(w);
  return delta > 0 ? 1 : -1;
}

/** Soft drag: wide smoothstep falloff with gentle per-stroke strength (knead-like). */
export function dragStroke(
  sampleMap,
  centerR,
  centerC,
  deltaR,
  deltaC,
  radius,
  strength = 0.75,
) {
  if (!radius || (!deltaR && !deltaC)) return sampleMap;
  const next = cloneSampleMap(sampleMap);
  const rows = sampleMap.length;
  const cols = sampleMap[0]?.length ?? 0;
  const r0 = Math.max(0, Math.floor(centerR - radius));
  const r1 = Math.min(rows - 1, Math.ceil(centerR + radius));
  const c0 = Math.max(0, Math.floor(centerC - radius));
  const c1 = Math.min(cols - 1, Math.ceil(centerC + radius));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dist = Math.hypot(r - centerR, c - centerC);
      const t = doughFalloff(dist, radius);
      if (!t) continue;
      const [sr, sc] = sampleMap[r][c];
      if (sr < 0 || sc < 0) continue;
      const stepR = dragStep(deltaR, t, strength);
      const stepC = dragStep(deltaC, t, strength);
      if (!stepR && !stepC) continue;
      next[r][c] = [
        clamp(sr - stepR, 0, rows - 1),
        clamp(sc - stepC, 0, cols - 1),
      ];
    }
  }
  return next;
}

/** Copy: destination reads from source cell in the original grid. */
export function copySampleCell(sampleMap, fromR, fromC, toR, toC) {
  const next = cloneSampleMap(sampleMap);
  next[toR][toC] = [fromR, fromC];
  return next;
}

/** Move: destination reads what destination used to read; source becomes empty. */
export function moveSampleCell(sampleMap, fromR, fromC, toR, toC) {
  const next = cloneSampleMap(sampleMap);
  next[toR][toC] = [...next[fromR][fromC]];
  next[fromR][fromC] = [-1, -1];
  return next;
}

export function clearSampleCell(sampleMap, row, col) {
  const next = cloneSampleMap(sampleMap);
  next[row][col] = [-1, -1];
  return next;
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

/** Move every cell in rect by delta; cleared source cells become empty. */
export function moveSampleRegion(sampleMap, rect, deltaR, deltaC, erasedCell = [-1, -1]) {
  const isComposite = erasedCell.length >= 3;
  deltaR = Math.round(deltaR);
  deltaC = Math.round(deltaC);
  if (!deltaR && !deltaC) {
    return isComposite ? normalizeCompositeMap(sampleMap) : sampleMap;
  }

  const source = isComposite ? normalizeCompositeMap(sampleMap) : sampleMap;
  const rows = source.length;
  const cols = source[0]?.length ?? 0;
  if (!rows || !cols) return source;

  const clone = isComposite ? cloneCompositeSampleMap : cloneSampleMap;
  const empty = [...erasedCell];

  const box = normalizeRect(rect.r0, rect.c0, rect.r1, rect.c1);
  const safe = {
    r0: Math.max(0, Math.min(Math.floor(box.r0), rows - 1)),
    c0: Math.max(0, Math.min(Math.floor(box.c0), cols - 1)),
    r1: Math.max(0, Math.min(Math.ceil(box.r1), rows - 1)),
    c1: Math.max(0, Math.min(Math.ceil(box.c1), cols - 1)),
  };
  if (safe.r0 > safe.r1 || safe.c0 > safe.c1) return source;

  const next = clone(source);
  const moved = [];

  for (let r = safe.r0; r <= safe.r1; r++) {
    const row = source[r];
    if (!Array.isArray(row)) continue;
    for (let c = safe.c0; c <= safe.c1; c++) {
      const val = row[c];
      if (!Array.isArray(val)) continue;
      if (isComposite) {
        if (val.length < 3) continue;
        const si = val[0] | 0;
        const sr = val[1] | 0;
        const sc = val[2] | 0;
        if (si < 0 || sr < 0 || sc < 0) continue;
        moved.push({ r, c, val: [si, sr, sc] });
      } else if (val[0] < 0 || val[1] < 0) {
        continue;
      } else {
        moved.push({ r, c, val: [...val] });
      }
      next[r][c] = [...empty];
    }
  }

  for (const { r, c, val } of moved) {
    const nr = r + deltaR;
    const nc = c + deltaC;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    next[nr][nc] = val;
  }

  return isComposite ? normalizeCompositeMap(next) : next;
}

export function resetSampleMap(rows, cols) {
  return createIdentitySampleMap(rows, cols);
}

export function sampleMapFromGrid(rows, cols) {
  return createIdentitySampleMap(rows, cols);
}

export function createEmptyTemplate(name = "Untitled pose") {
  return {
    id: crypto.randomUUID(),
    version: TRANSFORM_VERSION,
    name,
    cols: 26,
    slots: [
      {
        label: "Character A",
        offsetX: 0,
        offsetY: 0,
        rows: 0,
        cols: 26,
        sampleMap: [],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDualSlotTemplate(name = "Two character pose") {
  const t = createEmptyTemplate(name);
  t.slots = [
    { label: "Character A", offsetX: 0, offsetY: 0, rows: 0, cols: 26, sampleMap: [] },
    { label: "Character B", offsetX: 26, offsetY: 0, rows: 0, cols: 26, sampleMap: [] },
  ];
  return t;
}

export function initSlotFromGrid(slot, grid) {
  const rows = gridRows(grid);
  const cols = gridCols(grid);
  return {
    ...slot,
    rows,
    cols,
    sampleMap: createIdentitySampleMap(rows, cols),
  };
}

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => (t.slots?.length > 1 ? prepareDualTemplate(t) : t));
  } catch {
    return [];
  }
}

export function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function exportTemplateJson(template) {
  const synced = templateWithSyncedSlots(template);
  if (synced.slots.length > 1 && template.compositeSampleMap?.length) {
    return JSON.stringify(
      { ...synced, compositeSampleMap: template.compositeSampleMap },
      null,
      2,
    );
  }
  const { compositeSampleMap, ...rest } = synced;
  return JSON.stringify(rest, null, 2);
}

export function importTemplateJson(text) {
  const t = JSON.parse(text);
  if (!t?.slots?.length) throw new Error("Invalid template");
  return { ...t, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
}

/** Which slot owns a composite canvas cell (visible pixel, else topmost in bounds). */
export function resolveCompositeCell(slots, row, col, avatarGrids = null, layers = null) {
  if (layers?.length) {
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      const layer = layers[i];
      if (!layer?.length || !slot.sampleMap?.length) continue;

      const localRow = row - slot.offsetY;
      const localCol = col - slot.offsetX;
      if (localRow < 0 || localCol < 0) continue;

      const rows = slot.sampleMap.length;
      const cols = slot.sampleMap[0]?.length ?? 0;
      if (localRow >= rows || localCol >= cols) continue;

      const lr = Math.floor(localRow);
      const lc = Math.floor(localCol);
      if (layer[lr]?.[lc]) {
        return { slotIndex: i, localRow, localCol, row, col };
      }
    }
  } else if (avatarGrids?.length) {
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      const grid = avatarGrids[i];
      if (!grid?.length || !slot.sampleMap?.length) continue;

      const localRow = row - slot.offsetY;
      const localCol = col - slot.offsetX;
      if (localRow < 0 || localCol < 0) continue;

      const rows = slot.sampleMap.length;
      const cols = slot.sampleMap[0]?.length ?? 0;
      if (localRow >= rows || localCol >= cols) continue;

      const lr = Math.floor(localRow);
      const lc = Math.floor(localCol);
      const transformed = applySampleMap(grid, slot.sampleMap);
      if (transformed[lr]?.[lc]) {
        return { slotIndex: i, localRow, localCol, row, col };
      }
    }
  }

  const candidates = [];
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i];
    const localRow = row - slot.offsetY;
    const localCol = col - slot.offsetX;
    if (localRow < 0 || localCol < 0) continue;
    const rows = slot.sampleMap?.length || slot.rows || 0;
    const cols = slot.sampleMap?.[0]?.length || slot.cols || 0;
    if (!rows || !cols) continue;
    if (localRow >= rows || localCol >= cols) continue;
    candidates.push({ slotIndex: i, localRow, localCol, row, col });
  }

  return candidates[0] ?? null;
}

export function slotCompositeBounds(slot) {
  const rows = slot.sampleMap?.length || slot.rows || 0;
  const cols = slot.sampleMap?.[0]?.length || slot.cols || 0;
  if (!rows || !cols) return null;
  return {
    r0: slot.offsetY,
    c0: slot.offsetX,
    r1: slot.offsetY + rows - 1,
    c1: slot.offsetX + cols - 1,
  };
}

export function clampRectToBounds(rect, bounds) {
  if (!bounds || !rect) return null;
  const r0 = Math.max(bounds.r0, Math.min(rect.r0, bounds.r1));
  const c0 = Math.max(bounds.c0, Math.min(rect.c0, bounds.c1));
  const r1 = Math.min(bounds.r1, Math.max(rect.r1, bounds.r0));
  const c1 = Math.min(bounds.c1, Math.max(rect.c1, bounds.c0));
  if (r0 > r1 || c0 > c1) return null;
  return { r0, c0, r1, c1 };
}

export function compositeRectToLocal(slot, rect) {
  return {
    r0: rect.r0 - slot.offsetY,
    c0: rect.c0 - slot.offsetX,
    r1: rect.r1 - slot.offsetY,
    c1: rect.c1 - slot.offsetX,
  };
}

export function localRectToComposite(slot, rect) {
  return {
    r0: rect.r0 + slot.offsetY,
    c0: rect.c0 + slot.offsetX,
    r1: rect.r1 + slot.offsetY,
    c1: rect.c1 + slot.offsetX,
  };
}

/** Build composite grid from slot avatars + sample maps. */
export function buildCompositeGrid(slots, avatarGrids) {
  if (!slots?.length) return null;
  const hasMaps = slots.every((s) => s.sampleMap?.length > 0);
  const hasGrids = avatarGrids.every((g) => g?.length);
  if (!hasMaps || !hasGrids) return null;
  return compositeSlots(slots, avatarGrids).grid;
}

/** Render helper: composite multiple transformed grids onto one canvas grid space. */
export function compositeSlots(slots, avatarBySlot, cellSize = 1) {
  let maxW = 0;
  let maxH = 0;
  const layers = slots.map((slot, i) => {
    const grid = avatarBySlot[i];
    if (!grid?.length || !slot.sampleMap?.length) return null;
    const transformed = applySampleMap(grid, slot.sampleMap);
    const w = slot.offsetX + transformed[0].length;
    const h = slot.offsetY + transformed.length;
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);
    return { transformed, offsetX: slot.offsetX, offsetY: slot.offsetY };
  });

  const out = Array.from({ length: maxH }, () =>
    Array.from({ length: maxW }, () => null),
  );

  for (const layer of layers) {
    if (!layer) continue;
    const { transformed, offsetX, offsetY } = layer;
    transformed.forEach((row, r) => {
      row.forEach((color, c) => {
        if (!color) return;
        const tr = offsetY + r;
        const tc = offsetX + c;
        if (tr < maxH && tc < maxW) out[tr][tc] = color;
      });
    });
  }

  return { grid: out, cellSize };
}
