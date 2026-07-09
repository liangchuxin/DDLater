import { useCallback, useEffect, useRef, useState } from "react";
import { renderEditorGrid, renderEditorComposite, compositeEditorLayout } from "../utils/pixelChar";
import {
  cloneGrid,
  copyGridCell,
  gridCellFromPointer,
  gridCellFromEditPointer,
  gridPointFromPointer,
  gridPointFromEditPointer,
  brushOverlayFromPointer,
  brushOverlayFromEditPointer,
  moveGridRegion,
  normalizeRect,
  normalizeHex,
  setGridPixel,
  translateRect,
} from "../utils/pixelGrid";
import {
  applySampleMap,
  createIdentitySampleMap,
  liquefyStroke,
} from "../utils/avatarTransform";
import { useRecentColors } from "../hooks/useRecentColors";
import "../styles/PixelGridEditor.css";

const TOOLS = {
  PAINT: "paint",
  PICK: "pick",
  ERASE: "erase",
  LIQUEFY: "liquefy",
  MOVE: "move",
  COPY: "copy",
};

const MAX_UNDO = 40;
const EDITOR_SIZE = 260;
const EDIT_CANVAS_BASE = 420;
const LIQUEFY_STEP = 0.45;

function pullBrushDelta(pendingDr, pendingDc, minStep) {
  let dr = 0;
  let dc = 0;
  let nextDr = pendingDr;
  let nextDc = pendingDc;

  if (Math.abs(nextDr) >= minStep) {
    dr = nextDr > 0 ? 1 : -1;
    nextDr -= dr;
  }
  if (Math.abs(nextDc) >= minStep) {
    dc = nextDc > 0 ? 1 : -1;
    nextDc -= dc;
  }

  return { dr, dc, pendingDr: nextDr, pendingDc: nextDc };
}

function EyedropperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M11.2 1.8 14.2 4.8 6.5 12.5 3.5 9.5 11.2 1.8ZM2.8 10.2 5.8 13.2 1.8 14.2 2.8 10.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 11.5 8.5 6 11 8.5 5.5 14H3v-2.5ZM9.8 2.2l4 4-1.8 1.8-4-4 1.8-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SelectionBox({ grid, rect, offset = { dr: 0, dc: 0 }, marquee = false }) {
  if (!grid?.length || !rect) return null;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return null;

  const r0 = rect.r0 + offset.dr;
  const c0 = rect.c0 + offset.dc;
  const r1 = rect.r1 + offset.dr;
  const c1 = rect.c1 + offset.dc;

  return (
    <span
      className={`pge-select-box${marquee ? " is-marquee" : ""}`}
      style={{
        left: `${(c0 / cols) * 100}%`,
        top: `${(r0 / rows) * 100}%`,
        width: `${((c1 - c0 + 1) / cols) * 100}%`,
        height: `${((r1 - r0 + 1) / rows) * 100}%`,
      }}
      aria-hidden="true"
    />
  );
}

function ReferenceLinesOverlay({ cuts, defaultRows, defaultCols, totalRows, panelCols }) {
  if (!totalRows || !panelCols) return null;

  const guideWidth = `${(Math.min(defaultCols, panelCols) / panelCols) * 100}%`;
  const verticalHeight = `${(defaultRows / totalRows) * 100}%`;
  const verticalLeft = `${(Math.min(defaultCols, panelCols) / panelCols) * 100}%`;

  const horizontalLines = (cuts ?? [])
    .map((cut, index) => {
      let row = cut + 1;
      if (index === 1) row -= 1;
      return row;
    })
    .filter((row) => row > 0 && row < totalRows);

  const fifthRow = defaultRows;
  const showFifthLine = fifthRow > 0 && fifthRow <= totalRows;

  return (
    <div className="pge-ref-lines" aria-hidden="true">
      {defaultCols <= panelCols && (
        <span
          className="pge-ref-line pge-ref-line-v"
          style={{ left: verticalLeft, height: verticalHeight }}
        />
      )}
      {horizontalLines.map((row) => (
        <span
          key={`cut-${row}`}
          className="pge-ref-line pge-ref-line-h"
          style={{ top: `${(row / totalRows) * 100}%`, width: guideWidth }}
        />
      ))}
      {showFifthLine && (
        <span
          className="pge-ref-line pge-ref-line-h"
          style={{ top: `${(fifthRow / totalRows) * 100}%`, width: guideWidth }}
        />
      )}
    </div>
  );
}

export default function PixelGridEditor({
  grid,
  onGridChange,
  enableMoveCopy = false,
  sessionPalette = [],
  onAddToPalette,
  referenceAvatar = null,
  canvasBaseSize,
}) {
  const canvasRef = useRef(null);
  const paintingRef = useRef(false);
  const paintedRef = useRef(false);
  const strokeStartRef = useRef(null);
  const undoStackRef = useRef([]);
  const colorInputRef = useRef(null);
  const moveRef = useRef({
    phase: null,
    anchor: null,
    startCell: null,
    lastRect: null,
  });
  const brushDragRef = useRef({
    active: false,
    lastPoint: null,
    pendingDr: 0,
    pendingDc: 0,
  });
  const liquefyBaseRef = useRef(null);
  const sampleMapRef = useRef(null);
  const liquefyTouchedRef = useRef(false);

  const [tool, setTool] = useState(TOOLS.PAINT);
  const [color, setColor] = useState("#000000");
  const [canUndo, setCanUndo] = useState(false);
  const [pickStep, setPickStep] = useState(null);
  const [selection, setSelection] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [moveOffset, setMoveOffset] = useState(null);
  const [brushRadius, setBrushRadius] = useState(4);
  const [brushOverlay, setBrushOverlay] = useState(null);
  const [showRefLines, setShowRefLines] = useState(false);
  const [showRefGhost, setShowRefGhost] = useState(false);
  const [hint, setHint] = useState("");
  const { recentColors, addRecentColor } = useRecentColors();

  const referenceGrid = referenceAvatar?.avatarGrid ?? null;
  const referenceCuts = referenceAvatar?.avatarCuts ?? null;
  const hasReference = Boolean(referenceGrid?.length);
  const layout = compositeEditorLayout(grid, referenceGrid, showRefGhost && hasReference);
  const canvasMaxSize = Math.max(
    canvasBaseSize ?? (enableMoveCopy ? EDIT_CANVAS_BASE : EDITOR_SIZE),
    Math.max(layout.totalCols, layout.totalRows, 1) * 8,
  );
  const editLayerStyle =
    layout.ghostOn && layout.totalCols
      ? { width: `${(layout.editCols / layout.totalCols) * 100}%` }
      : undefined;

  const cellFromEvent = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas || !grid) return null;
      if (hasReference) {
        return gridCellFromEditPointer(
          canvas,
          grid,
          referenceGrid,
          showRefGhost,
          clientX,
          clientY,
        );
      }
      return gridCellFromPointer(canvas, grid, clientX, clientY);
    },
    [grid, hasReference, referenceGrid, showRefGhost],
  );

  const pointFromEvent = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas || !grid) return null;
      if (hasReference) {
        return gridPointFromEditPointer(
          canvas,
          grid,
          referenceGrid,
          showRefGhost,
          clientX,
          clientY,
        );
      }
      return gridPointFromPointer(canvas, grid, clientX, clientY);
    },
    [grid, hasReference, referenceGrid, showRefGhost],
  );

  useEffect(() => {
    if (!canvasRef.current || !grid) return;
    if (hasReference) {
      renderEditorComposite(canvasRef.current, grid, canvasMaxSize, {
        referenceGrid,
        showReference: showRefGhost,
      });
      return;
    }
    renderEditorGrid(canvasRef.current, grid, canvasMaxSize);
  }, [grid, canvasMaxSize, hasReference, referenceGrid, showRefGhost]);

  useEffect(() => {
    if (tool !== TOOLS.MOVE) {
      setMarquee(null);
      setMoveOffset(null);
      moveRef.current = {
        phase: null,
        anchor: null,
        startCell: null,
        lastRect: null,
      };
    }
    if (tool !== TOOLS.COPY) setPickStep(null);
    if (tool !== TOOLS.LIQUEFY) {
      setBrushOverlay(null);
      brushDragRef.current = {
        active: false,
        lastPoint: null,
        pendingDr: 0,
        pendingDc: 0,
      };
      liquefyBaseRef.current = null;
      sampleMapRef.current = null;
      liquefyTouchedRef.current = false;
    }
  }, [tool]);

  const pushUndo = useCallback((snapshot) => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      snapshot,
    ];
    setCanUndo(true);
  }, []);

  const commitGrid = useCallback(
    (nextGrid, { undo = true } = {}) => {
      if (undo && grid) pushUndo(cloneGrid(grid));
      onGridChange(nextGrid);
    },
    [grid, onGridChange, pushUndo],
  );

  const selectColor = useCallback(
    (nextColor, { remember = true } = {}) => {
      const hex = normalizeHex(nextColor);
      if (!hex) return;
      setColor(hex);
      if (remember) addRecentColor(hex);
      setTool(TOOLS.PAINT);
    },
    [addRecentColor, tool],
  );

  const applyAt = useCallback(
    (row, col) => {
      if (!grid) return;

      if (tool === TOOLS.PICK) {
        const picked = grid[row]?.[col];
        if (picked) selectColor(picked);
        return;
      }

      const nextColor = tool === TOOLS.ERASE ? null : color;
      if (grid[row][col] === nextColor) return;

      paintedRef.current = true;
      onGridChange(setGridPixel(grid, row, col, nextColor));
      if (nextColor) addRecentColor(nextColor);
    },
    [addRecentColor, color, grid, onGridChange, selectColor, tool],
  );

  const cellInRect = (cell, rect) =>
    cell.row >= rect.r0 &&
    cell.row <= rect.r1 &&
    cell.col >= rect.c0 &&
    cell.col <= rect.c1;

  const paintFromEvent = useCallback(
    (e) => {
      const cell = cellFromEvent(e.clientX, e.clientY);
      if (!cell) return;
      applyAt(cell.row, cell.col);
    },
    [applyAt, cellFromEvent],
  );

  const finishStroke = useCallback(() => {
    if (paintedRef.current && strokeStartRef.current) {
      pushUndo(strokeStartRef.current);
    }
    paintingRef.current = false;
    paintedRef.current = false;
    strokeStartRef.current = null;
  }, [pushUndo]);

  const handleMoveCopyPointer = useCallback(
    (e, phase) => {
      const cell = e ? cellFromEvent(e.clientX, e.clientY) : null;

      if (tool === TOOLS.MOVE) {
        if (phase === "down") {
          if (!cell) return;
          if (selection && cellInRect(cell, selection) && !marquee) {
            moveRef.current = {
              phase: "moving",
              anchor: selection,
              startCell: cell,
              lastRect: selection,
            };
            setMoveOffset({ dr: 0, dc: 0 });
            setHint("Drag to move selection");
            return;
          }
          moveRef.current = {
            phase: "selecting",
            anchor: cell,
            startCell: cell,
            lastRect: normalizeRect(cell.row, cell.col, cell.row, cell.col),
          };
          setSelection(null);
          setMoveOffset(null);
          setMarquee(moveRef.current.lastRect);
          setHint("Drag to select region");
          return;
        }

        if (phase === "move") {
          if (moveRef.current.phase === "selecting" && moveRef.current.anchor && cell) {
            const a = moveRef.current.anchor;
            const box = normalizeRect(a.row, a.col, cell.row, cell.col);
            moveRef.current.lastRect = box;
            setMarquee(box);
            return;
          }
          if (
            moveRef.current.phase === "moving" &&
            moveRef.current.startCell &&
            cell
          ) {
            const dr = cell.row - moveRef.current.startCell.row;
            const dc = cell.col - moveRef.current.startCell.col;
            setMoveOffset({ dr, dc });
          }
          return;
        }

        if (phase === "up" || phase === "cancel") {
          if (moveRef.current.phase === "selecting" && moveRef.current.anchor) {
            const box =
              moveRef.current.lastRect ??
              (cell
                ? normalizeRect(
                    moveRef.current.anchor.row,
                    moveRef.current.anchor.col,
                    cell.row,
                    cell.col,
                  )
                : null);
            if (box) {
              setSelection(box);
              setMarquee(null);
              setHint("Drag inside selection to move");
            }
          } else if (moveRef.current.phase === "moving" && moveRef.current.anchor) {
            const { anchor, startCell } = moveRef.current;
            const dr = Math.round(
              cell && startCell ? cell.row - startCell.row : 0,
            );
            const dc = Math.round(
              cell && startCell ? cell.col - startCell.col : 0,
            );
            if (dr || dc) {
              commitGrid(moveGridRegion(grid, anchor, dr, dc));
              setSelection(translateRect(anchor, dr, dc));
              setHint(`Moved by (${dr}, ${dc})`);
            }
            setMoveOffset(null);
          }
          moveRef.current = {
            phase: null,
            anchor: null,
            startCell: null,
            lastRect: null,
          };
        }
        return;
      }

      if (tool === TOOLS.COPY && phase === "down") {
        if (!cell) return;
        if (!pickStep) {
          setPickStep({ row: cell.row, col: cell.col });
          setHint(`Copy: picked (${cell.row},${cell.col}) — click destination`);
          return;
        }
        commitGrid(
          copyGridCell(grid, pickStep.row, pickStep.col, cell.row, cell.col),
        );
        setPickStep(null);
        setHint(`Copied (${pickStep.row},${pickStep.col}) → (${cell.row},${cell.col})`);
      }
    },
    [commitGrid, cellFromEvent, grid, marquee, pickStep, selection, tool],
  );

  const resetBrushDrag = useCallback(() => {
    brushDragRef.current = {
      active: false,
      lastPoint: null,
      pendingDr: 0,
      pendingDc: 0,
    };
  }, []);

  const applyLiquefyBrush = useCallback(
    (point, minStep = LIQUEFY_STEP) => {
      const drag = brushDragRef.current;
      if (!drag.active || !drag.lastPoint || !liquefyBaseRef.current || !sampleMapRef.current) {
        return false;
      }

      drag.pendingDr += point.row - drag.lastPoint.row;
      drag.pendingDc += point.col - drag.lastPoint.col;
      drag.lastPoint = point;

      const { dr, dc, pendingDr, pendingDc } = pullBrushDelta(
        drag.pendingDr,
        drag.pendingDc,
        minStep,
      );
      drag.pendingDr = pendingDr;
      drag.pendingDc = pendingDc;

      if (!dr && !dc) return false;

      sampleMapRef.current = liquefyStroke(
        sampleMapRef.current,
        point.row,
        point.col,
        dr,
        dc,
        brushRadius,
      );
      onGridChange(applySampleMap(liquefyBaseRef.current, sampleMapRef.current));
      liquefyTouchedRef.current = true;
      return true;
    },
    [brushRadius, onGridChange],
  );

  const updateBrushOverlay = useCallback(
    (e) => {
      if (tool !== TOOLS.LIQUEFY || !grid?.length) {
        setBrushOverlay(null);
        return;
      }
      const canvas = canvasRef.current;
      const overlay = hasReference
        ? brushOverlayFromEditPointer(
            canvas,
            grid,
            referenceGrid,
            showRefGhost,
            e.clientX,
            e.clientY,
            brushRadius,
          )
        : brushOverlayFromPointer(canvas, grid, e.clientX, e.clientY, brushRadius);
      setBrushOverlay(overlay);
    },
    [brushRadius, grid, hasReference, referenceGrid, showRefGhost, tool],
  );

  const handleLiquefyPointer = useCallback(
    (e, phase) => {
      const canvas = canvasRef.current;
      if (!canvas || !grid?.length) return;
      const point = e ? pointFromEvent(e.clientX, e.clientY) : null;

      if (phase === "down") {
        if (!point) return;
        liquefyBaseRef.current = cloneGrid(grid);
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;
        sampleMapRef.current = createIdentitySampleMap(rows, cols);
        liquefyTouchedRef.current = false;
        brushDragRef.current = {
          active: true,
          lastPoint: point,
          pendingDr: 0,
          pendingDc: 0,
        };
        setHint("Drag to warp pixels");
        return;
      }

      if (phase === "move" && brushDragRef.current.active) {
        if (!point) return;
        applyLiquefyBrush(point);
        return;
      }

      if (phase === "up" || phase === "cancel") {
        if (brushDragRef.current.active && point) {
          applyLiquefyBrush(point);
          const drag = brushDragRef.current;
          if (drag.pendingDr || drag.pendingDc) {
            applyLiquefyBrush(point, LIQUEFY_STEP * 0.35);
          }
        }
        if (liquefyTouchedRef.current && liquefyBaseRef.current) {
          pushUndo(liquefyBaseRef.current);
        }
        resetBrushDrag();
        liquefyBaseRef.current = null;
        sampleMapRef.current = null;
        liquefyTouchedRef.current = false;
      }
    },
    [applyLiquefyBrush, grid, pointFromEvent, pushUndo, resetBrushDrag],
  );

  const onPointerDown = (e) => {
    if (!grid || e.button !== 0) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    if (enableMoveCopy && tool === TOOLS.LIQUEFY) {
      handleLiquefyPointer(e, "down");
      return;
    }

    if (enableMoveCopy && (tool === TOOLS.MOVE || tool === TOOLS.COPY)) {
      handleMoveCopyPointer(e, "down");
      return;
    }

    strokeStartRef.current = cloneGrid(grid);
    paintedRef.current = false;
    paintingRef.current = true;
    paintFromEvent(e);
  };

  const onPointerMove = (e) => {
    if (enableMoveCopy && tool === TOOLS.LIQUEFY) {
      updateBrushOverlay(e);
      if (brushDragRef.current.active) {
        handleLiquefyPointer(e, "move");
      }
      return;
    }
    if (enableMoveCopy && tool === TOOLS.MOVE && moveRef.current.phase) {
      handleMoveCopyPointer(e, "move");
      return;
    }
    if (!paintingRef.current) return;
    paintFromEvent(e);
  };

  const onPointerUp = (e) => {
    if (enableMoveCopy && tool === TOOLS.LIQUEFY) {
      handleLiquefyPointer(e, "up");
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (enableMoveCopy && (tool === TOOLS.MOVE || tool === TOOLS.COPY)) {
      if (tool === TOOLS.MOVE) handleMoveCopyPointer(e, "up");
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (!paintingRef.current) return;
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    finishStroke();
  };

  const onPointerLeave = (e) => {
    if (enableMoveCopy && tool === TOOLS.LIQUEFY && brushDragRef.current.active) {
      handleLiquefyPointer(e ?? null, "cancel");
      if (e && canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (enableMoveCopy && tool === TOOLS.MOVE && moveRef.current.phase) {
      handleMoveCopyPointer(null, "cancel");
      return;
    }
    if (!paintingRef.current) return;
    finishStroke();
  };

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    resetBrushDrag();
    liquefyBaseRef.current = null;
    sampleMapRef.current = null;
    liquefyTouchedRef.current = false;
    onGridChange(cloneGrid(prev));
  }, [onGridChange, resetBrushDrag]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  const setActiveTool = (id) => {
    setTool(id);
    setPickStep(null);
    if (id !== TOOLS.MOVE) setSelection(null);
    setHint("");
  };

  if (!grid) return null;

  const defaultHint =
    tool === TOOLS.PICK
      ? "Click a pixel to pick its color"
      : tool === TOOLS.LIQUEFY
        ? "Drag to push pixels — green ring shows brush size"
        : tool === TOOLS.MOVE
          ? "Drag to select, then drag selection to move"
          : tool === TOOLS.COPY
            ? "Click source cell, then destination"
            : "Click or drag to paint · eraser clears pixels";

  return (
    <div className={`pge-wrap${enableMoveCopy ? " is-edit-mode" : ""}`}>
      <div className={`as-preview-box pge-canvas-box${enableMoveCopy ? " is-edit-large" : ""}`}>
        <span className="as-preview-label">Edit</span>
        <div className="pge-canvas-inner">
          <canvas
            ref={canvasRef}
            className={`pge-canvas${tool === TOOLS.PICK ? " is-picking" : ""}${tool === TOOLS.MOVE ? " is-moving" : ""}${tool === TOOLS.LIQUEFY ? " is-liquefy" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            role="img"
            aria-label="Pixel character editor"
          />
          <div className="pge-edit-layer" style={editLayerStyle}>
            {hasReference && showRefLines && (
              <ReferenceLinesOverlay
                cuts={referenceCuts}
                defaultRows={referenceGrid.length}
                defaultCols={referenceGrid[0]?.length ?? 0}
                totalRows={layout.totalRows}
                panelCols={layout.editCols}
              />
            )}
            {enableMoveCopy && tool === TOOLS.LIQUEFY && brushOverlay && (
              <span
                className="pge-brush-ring"
                style={{
                  left: brushOverlay.x,
                  top: brushOverlay.y,
                  width: brushOverlay.radiusX * 2,
                  height: brushOverlay.radiusY * 2,
                }}
                aria-hidden="true"
              />
            )}
            {enableMoveCopy && marquee && (
              <SelectionBox grid={grid} rect={marquee} marquee />
            )}
            {enableMoveCopy && selection && !marquee && (
              <SelectionBox grid={grid} rect={selection} offset={moveOffset ?? { dr: 0, dc: 0 }} />
            )}
          </div>
          {hasReference && showRefLines && showRefGhost && layout.ghostOn && (
            <div
              className="pge-ref-ghost-layer"
              style={{
                left: `${(layout.editCols / layout.totalCols) * 100}%`,
                width: `${(layout.refCols / layout.totalCols) * 100}%`,
              }}
            >
              <ReferenceLinesOverlay
                cuts={referenceCuts}
                defaultRows={referenceGrid.length}
                defaultCols={referenceGrid[0]?.length ?? 0}
                totalRows={layout.totalRows}
                panelCols={layout.refCols}
              />
            </div>
          )}
        </div>
        <div className="pge-canvas-footer">
          <span className="pge-hint">{hint || defaultHint}</span>
          {hasReference && (
            <div className="pge-canvas-toggles">
              <label className="pge-toggle">
                <input
                  type="checkbox"
                  checked={showRefLines}
                  onChange={(e) => setShowRefLines(e.target.checked)}
                />
                <span>Reference lines</span>
              </label>
              <label className="pge-toggle">
                <input
                  type="checkbox"
                  checked={showRefGhost}
                  onChange={(e) => setShowRefGhost(e.target.checked)}
                />
                <span>Reference character</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="pge-tools">
        <div className="pge-tools-head">Tools</div>

        <div className="pge-tool-row">
          <button
            type="button"
            className={`pge-tool-btn${tool === TOOLS.PAINT ? " is-active" : ""}`}
            onClick={() => setActiveTool(TOOLS.PAINT)}
          >
            Paint
          </button>
          <button
            type="button"
            className={`pge-tool-btn${tool === TOOLS.PICK ? " is-active" : ""}`}
            onClick={() => setActiveTool(TOOLS.PICK)}
            title="Eyedropper"
          >
            <EyedropperIcon />
            <span>Pick</span>
          </button>
          <button
            type="button"
            className={`pge-tool-btn${tool === TOOLS.ERASE ? " is-active" : ""}`}
            onClick={() => setActiveTool(TOOLS.ERASE)}
            title="Eraser"
          >
            <EraserIcon />
            <span>Erase</span>
          </button>
        </div>

        {enableMoveCopy && (
          <div className="pge-tool-row">
            <button
              type="button"
              className={`pge-tool-btn${tool === TOOLS.LIQUEFY ? " is-active" : ""}`}
              onClick={() => setActiveTool(TOOLS.LIQUEFY)}
            >
              Liquefy
            </button>
            <button
              type="button"
              className={`pge-tool-btn${tool === TOOLS.MOVE ? " is-active" : ""}`}
              onClick={() => setActiveTool(TOOLS.MOVE)}
            >
              Move
            </button>
            <button
              type="button"
              className={`pge-tool-btn${tool === TOOLS.COPY ? " is-active" : ""}`}
              onClick={() => setActiveTool(TOOLS.COPY)}
            >
              Copy
            </button>
          </div>
        )}

        {enableMoveCopy && tool === TOOLS.LIQUEFY && (
          <label className="pge-slider-label">
            Brush radius: {brushRadius}
            <input
              type="range"
              min={2}
              max={12}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
            />
          </label>
        )}

        <div className="pge-tools-head">Colors</div>

        <div className="pge-current-row">
          <button
            type="button"
            className="pge-swatch pge-swatch-current"
            style={{ background: color }}
            onClick={() => colorInputRef.current?.click()}
            aria-label={`Current color ${color}`}
          />
          <label className="pge-color-picker" onClick={() => colorInputRef.current?.click()}>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => selectColor(e.target.value, { remember: false })}
              aria-label="Color picker"
              tabIndex={-1}
            />
            <span className="pge-hex">{color}</span>
          </label>
        </div>

        {onAddToPalette && (
          <button
            type="button"
            className="pge-tool-btn pge-palette-add"
            onClick={() => onAddToPalette(color)}
          >
            Add to palette
          </button>
        )}

        <button
          type="button"
          className="pge-tool-btn pge-undo-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>

        {sessionPalette.length > 0 && (
          <div className="pge-recent">
            <span className="pge-recent-label">Palette</span>
            <div className="pge-recent-swatches">
              {sessionPalette.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`pge-swatch${hex.toLowerCase() === color.toLowerCase() ? " is-active" : ""}`}
                  style={{ background: hex }}
                  onClick={() => selectColor(hex, { remember: false })}
                  aria-label={`Use palette color ${hex}`}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}

        {recentColors.length > 0 && (
          <div className="pge-recent">
            <span className="pge-recent-label">Recent</span>
            <div className="pge-recent-swatches">
              {recentColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`pge-swatch${hex.toLowerCase() === color.toLowerCase() ? " is-active" : ""}`}
                  style={{ background: hex }}
                  onClick={() => selectColor(hex)}
                  aria-label={`Use color ${hex}`}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
