/**
 * pixelChar.js
 * DDLater 像素角色工具库
 * 零依赖，纯浏览器 Canvas API
 *
 * 使用流程：
 *   1. imageToGrid(imgElement)          → grid（二维颜色数组，存 MongoDB）
 *   2. renderStatic(canvas, grid)       → 画静态角色
 *   3. startAnimation(canvas, grid, cfg) → 返回 stop 函数，开始 idle 动画
 */

// ─────────────────────────────────────────────
// 1. 图片 → 颜色网格
// ─────────────────────────────────────────────

const COLS = 26; // 固定 26 列

/**
 * 把 HTMLImageElement 转成颜色网格
 * @param {HTMLImageElement} img
 * @returns {(string|null)[][]} grid  null = 透明格
 */
export function imageToGrid(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const N = COLS;
  const M = Math.max(1, Math.round(N * img.naturalHeight / img.naturalWidth));
  let grid = extractColorGrid(ctx, img.naturalWidth, img.naturalHeight, N, M);
  grid = autoRemoveBackground(grid, 40);
  return grid;
}

/**
 * 从 canvas ctx 提取颜色网格（dominant 模式，适合卡通像素图）
 */
function extractColorGrid(ctx, imgW, imgH, N, M) {
  const { data } = ctx.getImageData(0, 0, imgW, imgH);
  return Array.from({ length: M }, (_, j) =>
    Array.from({ length: N }, (_, i) => {
      const sx = Math.floor(i * imgW / N), ex = Math.min(imgW, Math.ceil((i + 1) * imgW / N));
      const sy = Math.floor(j * imgH / M), ey = Math.min(imgH, Math.ceil((j + 1) * imgH / M));
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
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    })
  );
}

/**
 * 从四边 flood fill 去除背景色（容差版）
 * @param {(string|null)[][]} grid
 * @param {number} tolerance  RGB 欧氏距离阈值，默认 40
 */
function autoRemoveBackground(grid, tolerance = 40) {
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return grid;

  const bc = new Map();
  const tally = (r, c) => { const col = grid[r]?.[c]; if (col) bc.set(col, (bc.get(col) ?? 0) + 1); };
  for (let c = 0; c < N; c++) { tally(0, c); tally(M - 1, c); }
  for (let r = 1; r < M - 1; r++) { tally(r, 0); tally(r, N - 1); }
  if (!bc.size) return grid;

  let target = '', max = -1;
  bc.forEach((v, k) => { if (v > max) { max = v; target = k; } });

  const hexDist = (a, b) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const dr = ((pa >> 16) & 0xff) - ((pb >> 16) & 0xff);
    const dg = ((pa >> 8)  & 0xff) - ((pb >> 8)  & 0xff);
    const db = (pa & 0xff)         - (pb & 0xff);
    return Math.sqrt(dr*dr + dg*dg + db*db);
  };

  const ng = grid.map(row => [...row]);
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
    push(r-1,c); push(r+1,c); push(r,c-1); push(r,c+1);
  }
  return ng;
}

// ─────────────────────────────────────────────
// 2. 静态渲染
// ─────────────────────────────────────────────

/**
 * 把颜色网格渲染到 canvas（棋盘格 = 透明）
 * @param {HTMLCanvasElement} canvas
 * @param {(string|null)[][]} grid
 * @param {number} [maxSize=260]  canvas 最大边长（px）
 */
export function renderStatic(canvas, grid, maxSize = 260) {
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return;
  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  canvas.width = N * cs; canvas.height = M * cs;
  const ctx = canvas.getContext('2d');
  _checkerboard(ctx, canvas.width, canvas.height, Math.max(4, cs));
  grid.forEach((row, j) => row.forEach((col, i) => {
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(i * cs, j * cs, cs, cs);
  }));
}

// ─────────────────────────────────────────────
// 3. Idle 动画
// ─────────────────────────────────────────────

/**
 * 默认动画配置（可被覆盖或随机化）
 *
 * cuts: [cutA, cutB, cutC]  三个水平切分行索引（ABCD 四段，D 不动）
 * amp: 振幅格数（固定，不随机）
 * stepFrames: 每格停留帧数
 * gapAB: A 落完到 B 开始落的间隔帧数（短）
 * gapBC: B 落完到 C 开始落的间隔帧数（长）
 * holdFrames: 全部归位后静止帧数
 */
export const DEFAULT_ANIM_CONFIG = {
  cuts: [10, 30, 50],  // 生成后根据实际 M 自动计算，这里是占位
  amp: 1,
  stepFrames: 13,
  gapAB: 0,
  gapBC: 20,
  holdFrames: 100,
};

/**
 * 根据 grid 行数自动计算默认切分点（保持 D 为底部 7 行）
 * @param {number} M  总行数
 * @returns {[number, number, number]}
 */
export function defaultCuts(M) {
  const cutA = Math.floor(M / 3);
  const cutB = Math.floor(M * 2 / 3);
  const cutC = Math.max(cutB + 1, M - 7);
  return [cutA, cutB, cutC];
}

/**
 * 在 cfg 的 stepFrames / gapAB / gapBC / holdFrames 基础上加随机扰动
 * amp 和 cuts 保持不变（由调用方固定）
 * @param {object} base  基础配置
 * @param {number} [jitter=0.3]  随机幅度（0~1，相对值）
 * @returns {object}
 */
export function randomizeAnimConfig(base, jitter = 0.3) {
  const rand = (v) => Math.max(1, Math.round(v * (1 + (Math.random() * 2 - 1) * jitter)));
  return {
    ...base,
    stepFrames:  rand(base.stepFrames),
    gapAB:       Math.max(0, rand(base.gapAB || 5)),
    gapBC:       rand(base.gapBC),
    holdFrames:  rand(base.holdFrames),
  };
}

/**
 * 开始 idle 动画，返回 stop() 函数
 * @param {HTMLCanvasElement} canvas
 * @param {(string|null)[][]} grid
 * @param {object} cfg  动画配置（包含 cuts, amp, stepFrames, gapAB, gapBC, holdFrames）
 * @param {number} [maxSize=260]
 * @returns {() => void}  stop 函数
 */
export function startAnimation(canvas, grid, cfg, maxSize = 260) {
  const { cuts, amp, stepFrames, gapAB, gapBC, holdFrames } = cfg;
  const M = grid.length, N = grid[0]?.length ?? 0;
  if (!M || !N) return () => {};

  const cs = Math.max(1, Math.floor(maxSize / Math.max(N, M)));
  const canvasH = (M + amp * 2 + 4) * cs;
  canvas.width = N * cs;
  canvas.height = canvasH;

  let t = 0, raf = 0;

  const loop = () => {
    _renderFrame(canvas, grid, N, M, cuts, t++, amp, stepFrames, gapAB, gapBC, holdFrames, cs);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(raf);
}

// ─────────────────────────────────────────────
// 内部函数（不 export）
// ─────────────────────────────────────────────

function _checkerboard(ctx, w, h, size) {
  for (let y = 0; y < h; y += size)
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x/size + y/size) % 2 === 0) ? '#cccccc' : '#ffffff';
      ctx.fillRect(x, y, size, size);
    }
}

function _segmentOffsets(t, amp, stepFrames, gapAB, gapBC, holdFrames) {
  const movF = amp * stepFrames;
  const p1 = movF;
  const p2 = p1 + movF;
  const p3 = p2 + gapAB;
  const p4 = p3 + movF;
  const p5 = p4 + gapBC;
  const p6 = p5 + movF;
  const total = p6 + holdFrames;
  const f = t % total;

  let a = 0, b = 0, c = 0;
  if (f < p1) {
    const step = Math.floor(f / stepFrames) + 1;
    a = b = c = -step;
  } else if (f < p2) {
    const step = Math.floor((f - p1) / stepFrames) + 1;
    a = -(amp - step); b = c = -amp;
  } else if (f < p3) {
    a = 0; b = c = -amp;
  } else if (f < p4) {
    const step = Math.floor((f - p3) / stepFrames) + 1;
    a = 0; b = -(amp - step); c = -amp;
  } else if (f < p5) {
    a = 0; b = 0; c = -amp;
  } else if (f < p6) {
    const step = Math.floor((f - p5) / stepFrames) + 1;
    a = 0; b = 0; c = -(amp - step);
  }
  return [a, b, c, 0]; // D = 0，永远不动
}

function _drawSeg(ctx, grid, startRow, endRow, cs, baseY, dyPx) {
  for (let j = startRow; j <= endRow; j++) {
    const py = baseY + j * cs + dyPx;
    grid[j]?.forEach((col, i) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(i * cs, py, cs, cs);
    });
  }
}

function _fillGap(ctx, grid, edgeRow, cs, from, to) {
  if (to <= from) return;
  const row = grid[edgeRow] ?? [];
  for (let py = from; py < to; py += cs)
    row.forEach((col, i) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(i * cs, py, cs, cs);
    });
}

function _renderFrame(canvas, grid, N, M, cuts, t, amp, stepFrames, gapAB, gapBC, holdFrames, cs) {
  const [cutA, cutB, cutC] = cuts;
  const [aOff, bOff, cOff, dOff] = _segmentOffsets(t, amp, stepFrames, gapAB, gapBC, holdFrames);
  const baseY = amp * cs;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  _checkerboard(ctx, canvas.width, canvas.height, Math.max(4, cs));

  const segs = [
    { start: 0,      end: cutA, dy: aOff * cs },
    { start: cutA+1, end: cutB, dy: bOff * cs },
    { start: cutB+1, end: cutC, dy: cOff * cs },
    { start: cutC+1, end: M-1,  dy: dOff * cs },
  ];

  segs.forEach((seg, idx) => {
    _drawSeg(ctx, grid, seg.start, seg.end, cs, baseY, seg.dy);
    if (idx < segs.length - 1) {
      const next = segs[idx + 1];
      const thisBottom = baseY + seg.end * cs + seg.dy + cs;
      const nextTop    = baseY + next.start * cs + next.dy;
      _fillGap(ctx, grid, seg.end, cs, thisBottom, nextTop);
    }
  });
}
