/**
 * DDLater pixel character tools using canvas api
 *   1. imageToGrid(imgElement)           -> grid (2D color array, store in MongoDB)
 *   2. autoRemoveBackground(grid)        -> grid with background removed
 *   3. renderStatic(canvas, grid, size, transparent) -> render static character
 *   4. startAnimation(canvas, grid, cfg, size, transparent) -> returns stop fn
 *
 * Pixel extraction and flood-fill logic adapted from
 * https://github.com/Zippland/perler-beads (MIT License)
 */

const COLS = 26;

export const DEFAULT_BG_TOLERANCE = 40;
export const MIN_BG_TOLERANCE = 0;
export const MAX_BG_TOLERANCE = 90;
export const BG_TOLERANCE_STEP = 5;

export function imageToRawGrid(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const N = COLS;
  const M = Math.max(1, Math.round((N * img.naturalHeight) / img.naturalWidth));
  return extractColorGrid(ctx, img.naturalWidth, img.naturalHeight, N, M);
}

export function imageToGrid(img, tolerance = DEFAULT_BG_TOLERANCE) {
  const grid = imageToRawGrid(img);
  return autoRemoveBackground(grid, tolerance);
}

function extractColorGrid(ctx, imgW, imgH, N, M) {
  const { data } = ctx.getImageData(0, 0, imgW, imgH);
  return Array.from({ length: M }, (_, j) =>
    Array.from({ length: N }, (_, i) => {
      const sx = Math.floor((i * imgW) / N), ex = Math.min(imgW, Math.ceil(((i + 1) * imgW) / N));
      const sy = Math.floor((j * imgH) / M), ey = Math.min(imgH, Math.ceil(((j + 1) * imgH) / M));
      const cw = Math.max(1, ex - sx), ch = Math.max(1, ey - sy);
      const cc = {};
      let maxC = 0, dom = null;
      for (let y = sy; y < sy + ch; y++) {
        for (let x = sx; x < sx + cw; x++) {
          const idx = (y * imgW + x) * 4;
          if (data[idx + 3] < 128) continue;
          const [r, g, b] = [data[idx], data[idx + 1], data[idx + 2]];
          const k = `${r >> 4},${g >> 4},${b >> 4}`;
          if (!cc[k]) cc[k] = { count: 0, r, g, b };
          if (++cc[k].count > maxC) { maxC = cc[k].count; dom = cc[k]; }
        }
      }
      if (!dom) return null;
      const { r, g, b } = dom;
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }),
  );
}

export function autoRemoveBackground(grid, tolerance = 40) {
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N || tolerance <= 0) return grid.map((row) => [...row]);
  const bc = new Map();
  const tally = (r, c) => { const col = grid[r]?.[c]; if (col) bc.set(col, (bc.get(col) ?? 0) + 1); };
  for (let c = 0; c < N; c++) { tally(0, c); tally(M - 1, c); }
  for (let r = 1; r < M - 1; r++) { tally(r, 0); tally(r, N - 1); }
  if (!bc.size) return grid;
  let target = "", max = -1;
  bc.forEach((v, k) => { if (v > max) { max = v; target = k; } });
  const hexDist = (a, b) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const dr = ((pa >> 16) & 0xff) - ((pb >> 16) & 0xff);
    const dg = ((pa >> 8) & 0xff) - ((pb >> 8) & 0xff);
    const db = (pa & 0xff) - (pb & 0xff);
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const ng = grid.map((row) => [...row]);
  const vis = Array.from({ length: M }, () => new Array(N).fill(false));
  const stack = [];
  const push = (r, c) => {
    if (r < 0 || r >= M || c < 0 || c >= N || vis[r][c]) return;
    const col = ng[r][c];
    if (col === null || hexDist(col, target) >= tolerance) return;
    vis[r][c] = true; stack.push([r, c]);
  };
  for (let c = 0; c < N; c++) { push(0, c); push(M - 1, c); }
  for (let r = 1; r < M - 1; r++) { push(r, 0); push(r, N - 1); }
  while (stack.length) {
    const [r, c] = stack.pop();
    ng[r][c] = null;
    push(r - 1, c); push(r + 1, c); push(r, c - 1); push(r, c + 1);
  }
  return ng;
}

// transparent=true skips the checkerboard background for a transparent canvas.
export function renderStatic(canvas, grid, maxSize = 260, transparent = false) {
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return;
  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  canvas.width = N * cs; canvas.height = M * cs;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!transparent) _checkerboard(ctx, canvas.width, canvas.height, Math.max(4, cs));
  grid.forEach((row, j) => row.forEach((col, i) => {
    if (!col) return;
    ctx.fillStyle = col; ctx.fillRect(i * cs, j * cs, cs, cs);
  }));
}

/** Static preview with per-cell borders for the pixel editor. */
export function renderEditorGrid(canvas, grid, maxSize = 260) {
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return;
  renderStatic(canvas, grid, maxSize, false);
  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  const ctx = canvas.getContext("2d");
  const w = N * cs;
  const h = M * cs;
  ctx.strokeStyle = "rgba(13, 13, 13, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= N; i++) {
    const x = i * cs + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 0; j <= M; j++) {
    const y = j * cs + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

export const DEFAULT_ANIM_CONFIG = {
  cuts: [10, 30, 50],
  amp: 1,
  stepFrames: 13,
  gapAB: 0,
  gapBC: 20,
  holdFrames: 100,
};

export function defaultCuts(M) {
  const cutA = Math.floor(M / 3);
  const cutB = Math.floor((M * 2) / 3);
  const cutC = Math.max(cutB + 1, M - 7);
  return [cutA, cutB, cutC];
}

/** Canvas pixel size for a grid at maxSize (matches startAnimation layout math). */
export function avatarCanvasDimensions(
  grid,
  maxSize = 260,
  clipBottomRows = 0,
  amp = DEFAULT_ANIM_CONFIG.amp,
) {
  const M = grid.length;
  const N = grid[0]?.length ?? 0;
  if (!M || !N) return { w: 0, h: 0, fullH: 0, cs: 1 };
  const effectiveM =
    clipBottomRows > 0 ? Math.min(M, M - clipBottomRows) : M;
  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  return {
    w: N * cs,
    h: (effectiveM + amp * 2 + 4) * cs,
    fullH: (M + amp * 2 + 4) * cs,
    cs,
  };
}

export function randomizeAnimConfig(base, jitter = 0.3) {
  const rand = (v) => Math.max(1, Math.round(v * (1 + (Math.random() * 2 - 1) * jitter)));
  return {
    ...base,
    stepFrames: rand(base.stepFrames),
    gapAB: Math.max(0, rand(base.gapAB || 5)),
    gapBC: rand(base.gapBC),
    holdFrames: rand(base.holdFrames),
  };
}

// transparent=true skips the checkerboard background.
// maxRow: optional, only render grid[0..maxRow]; rows beyond are skipped.
// Useful when furniture occludes the lower body (e.g. sofa hiding legs).
export function startAnimation(canvas, grid, cfg, maxSize = 260, transparent = false, maxRow = null) {
  const { cuts, amp, stepFrames, gapAB, gapBC, holdFrames } = cfg;
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return () => {};
  const effectiveM = maxRow != null ? Math.min(M, maxRow + 1) : M;
  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  canvas.width = N * cs;
  canvas.height = (effectiveM + amp * 2 + 4) * cs;
  let t = 0, raf = 0;
  const loop = () => {
    _renderFrame(canvas, grid, N, effectiveM, cuts, t++, amp, stepFrames, gapAB, gapBC, holdFrames, cs, transparent);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

function _checkerboard(ctx, w, h, size) {
  for (let y = 0; y < h; y += size)
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#cccccc" : "#ffffff";
      ctx.fillRect(x, y, size, size);
    }
}

function _segmentOffsets(t, amp, stepFrames, gapAB, gapBC, holdFrames) {
  const movF = amp * stepFrames;
  const p1 = movF, p2 = p1 + movF, p3 = p2 + gapAB;
  const p4 = p3 + movF, p5 = p4 + gapBC, p6 = p5 + movF;
  const f = t % (p6 + holdFrames);
  let a = 0, b = 0, c = 0;
  if (f < p1) { const s = Math.floor(f / stepFrames) + 1; a = b = c = -s; }
  else if (f < p2) { const s = Math.floor((f - p1) / stepFrames) + 1; a = -(amp - s); b = c = -amp; }
  else if (f < p3) { a = 0; b = c = -amp; }
  else if (f < p4) { const s = Math.floor((f - p3) / stepFrames) + 1; a = 0; b = -(amp - s); c = -amp; }
  else if (f < p5) { a = 0; b = 0; c = -amp; }
  else if (f < p6) { const s = Math.floor((f - p5) / stepFrames) + 1; a = 0; b = 0; c = -(amp - s); }
  return [a, b, c, 0];
}

function _drawSeg(ctx, grid, startRow, endRow, cs, baseY, dyPx) {
  for (let j = startRow; j <= endRow; j++) {
    const py = baseY + j * cs + dyPx;
    grid[j]?.forEach((col, i) => { if (!col) return; ctx.fillStyle = col; ctx.fillRect(i * cs, py, cs, cs); });
  }
}

function _fillGap(ctx, grid, edgeRow, cs, from, to) {
  if (to <= from) return;
  const row = grid[edgeRow] ?? [];
  for (let py = from; py < to; py += cs)
    row.forEach((col, i) => { if (!col) return; ctx.fillStyle = col; ctx.fillRect(i * cs, py, cs, cs); });
}

function _renderFrame(canvas, grid, N, M, cuts, t, amp, stepFrames, gapAB, gapBC, holdFrames, cs, transparent = false) {
  const [cutA, cutB, cutC] = cuts;
  const [aOff, bOff, cOff, dOff] = _segmentOffsets(t, amp, stepFrames, gapAB, gapBC, holdFrames);
  const baseY = amp * cs;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!transparent) _checkerboard(ctx, canvas.width, canvas.height, Math.max(4, cs));
  const segs = [
    { start: 0, end: cutA, dy: aOff * cs },
    { start: cutA + 1, end: cutB, dy: bOff * cs },
    { start: cutB + 1, end: cutC, dy: cOff * cs },
    { start: cutC + 1, end: M - 1, dy: dOff * cs },
  ];
  segs.forEach((seg, idx) => {
    _drawSeg(ctx, grid, seg.start, seg.end, cs, baseY, seg.dy);
    if (idx < segs.length - 1) {
      const next = segs[idx + 1];
      const thisBottom = baseY + seg.end * cs + seg.dy + cs;
      const nextTop = baseY + next.start * cs + next.dy;
      _fillGap(ctx, grid, seg.end, cs, thisBottom, nextTop);
    }
  });
}
