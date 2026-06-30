import { useCallback, useEffect, useRef, useState } from "react";
import { renderEditorGrid } from "../utils/pixelChar";
import { cloneGrid, gridCellFromPointer, normalizeHex, setGridPixel } from "../utils/pixelGrid";
import { useRecentColors } from "../hooks/useRecentColors";
import "../styles/PixelGridEditor.css";

const TOOLS = {
  PAINT: "paint",
  PICK: "pick",
  ERASE: "erase",
};

const MAX_UNDO = 40;
const EDITOR_SIZE = 260;

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

export default function PixelGridEditor({ grid, onGridChange }) {
  const canvasRef = useRef(null);
  const paintingRef = useRef(false);
  const paintedRef = useRef(false);
  const strokeStartRef = useRef(null);
  const undoStackRef = useRef([]);
  const colorInputRef = useRef(null);

  const [tool, setTool] = useState(TOOLS.PAINT);
  const [color, setColor] = useState("#000000");
  const [canUndo, setCanUndo] = useState(false);
  const { recentColors, addRecentColor } = useRecentColors();

  useEffect(() => {
    if (!canvasRef.current || !grid) return;
    renderEditorGrid(canvasRef.current, grid, EDITOR_SIZE);
  }, [grid]);

  const selectColor = useCallback(
    (nextColor, { remember = true } = {}) => {
      const hex = normalizeHex(nextColor);
      if (!hex) return;
      setColor(hex);
      if (remember) addRecentColor(hex);
      setTool(TOOLS.PAINT);
    },
    [addRecentColor],
  );

  const commitGrid = useCallback(
    (nextGrid) => {
      onGridChange(nextGrid);
    },
    [onGridChange],
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
      commitGrid(setGridPixel(grid, row, col, nextColor));
      if (nextColor) addRecentColor(nextColor);
    },
    [addRecentColor, color, commitGrid, grid, selectColor, tool],
  );

  const paintFromEvent = useCallback(
    (e) => {
      const cell = gridCellFromPointer(canvasRef.current, grid, e.clientX, e.clientY);
      if (!cell) return;
      applyAt(cell.row, cell.col);
    },
    [applyAt, grid],
  );

  const finishStroke = useCallback(() => {
    if (paintedRef.current && strokeStartRef.current) {
      undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), strokeStartRef.current];
      setCanUndo(true);
    }
    paintingRef.current = false;
    paintedRef.current = false;
    strokeStartRef.current = null;
  }, []);

  const onPointerDown = (e) => {
    if (!grid || e.button !== 0) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    strokeStartRef.current = cloneGrid(grid);
    paintedRef.current = false;
    paintingRef.current = true;
    paintFromEvent(e);
  };

  const onPointerMove = (e) => {
    if (!paintingRef.current) return;
    paintFromEvent(e);
  };

  const onPointerUp = (e) => {
    if (!paintingRef.current) return;
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    finishStroke();
  };

  const onPointerLeave = () => {
    if (!paintingRef.current) return;
    finishStroke();
  };

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    commitGrid(cloneGrid(prev));
  }, [commitGrid]);

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

  if (!grid) return null;

  return (
    <div className="pge-wrap">
      <div className="as-preview-box pge-canvas-box">
        <span className="as-preview-label">Edit</span>
        <canvas
          ref={canvasRef}
          className={`pge-canvas${tool === TOOLS.PICK ? " is-picking" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          role="img"
          aria-label="Pixel character editor. Paint, erase, or pick colors from the grid."
        />
        <span className="pge-hint">
          {tool === TOOLS.PICK
            ? "Click a pixel to pick its color"
            : "Click or drag to paint · eraser clears pixels"}
        </span>
      </div>

      <div className="pge-tools">
        <div className="pge-tools-head">Colors</div>

        <div className="pge-current-row">
          <button
            type="button"
            className="pge-swatch pge-swatch-current"
            style={{ background: color }}
            onClick={() => colorInputRef.current?.click()}
            aria-label={`Current color ${color}. Open color picker.`}
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

        <div className="pge-tool-row">
          <button
            type="button"
            className={`pge-tool-btn${tool === TOOLS.PICK ? " is-active" : ""}`}
            onClick={() => setTool((t) => (t === TOOLS.PICK ? TOOLS.PAINT : TOOLS.PICK))}
            aria-pressed={tool === TOOLS.PICK}
            title="Eyedropper"
          >
            <EyedropperIcon />
            <span>Pick</span>
          </button>
          <button
            type="button"
            className={`pge-tool-btn${tool === TOOLS.ERASE ? " is-active" : ""}`}
            onClick={() => setTool((t) => (t === TOOLS.ERASE ? TOOLS.PAINT : TOOLS.ERASE))}
            aria-pressed={tool === TOOLS.ERASE}
            title="Eraser"
          >
            <EraserIcon />
            <span>Erase</span>
          </button>
          <button
            type="button"
            className="pge-tool-btn pge-undo-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
        </div>

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
