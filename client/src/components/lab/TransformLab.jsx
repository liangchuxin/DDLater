import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PixelBox from "../PixelBox";
import { renderEditorGrid, editorCanvasMaxSize } from "../../utils/pixelChar";
import { gridCellFromPointer, gridPointFromPointer, brushOverlayFromPointer } from "../../utils/pixelGrid";
import {
  applySampleMap,
  applyCompositeSampleMap,
  cloneSampleMap,
  cloneCompositeSampleMap,
  copySampleCell,
  createDualSlotTemplate,
  createEmptyTemplate,
  exportTemplateJson,
  importTemplateJson,
  initSlotFromGrid,
  liquefyStroke,
  dragStroke,
  loadTemplates,
  mergeSlotsToCompositeMap,
  moveSampleRegion,
  normalizeCompositeMap,
  normalizeRect,
  resetCompositeSampleMap,
  resetSampleMap,
  saveTemplates,
  clearSampleCell,
  compactDualSlotOffsets,
  prepareDualTemplate,
  templateWithSyncedSlots,
  translateRect,
  ERASED_SAMPLE,
  unifiedClearSampleCell,
  unifiedCopySampleCell,
  unifiedDragStroke,
  unifiedLiquefyStroke,
} from "../../utils/avatarTransform";
import "../../styles/TransformLab.css";

const API = import.meta.env.VITE_API_URL;
const CANVAS_BASE = 360;
const CANVAS_MIN_CELL = 8;
const TOOLS = {
  LIQUEFY: "liquefy",
  DRAG: "drag",
  COPY: "copy",
  MOVE: "move",
  ERASE: "erase",
};

const BRUSH_TOOLS = new Set([TOOLS.LIQUEFY, TOOLS.DRAG]);
const BRUSH_STEP = {
  [TOOLS.LIQUEFY]: 0.45,
  [TOOLS.DRAG]: 0.28,
};
const MAX_UNDO = 40;

function cloneMapSnapshot(map, isDual) {
  return isDual ? normalizeCompositeMap(cloneCompositeSampleMap(map)) : cloneSampleMap(map);
}

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
      className={`tl-select-box${marquee ? " is-marquee" : ""}`}
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

function CanvasOverlays({ grid, brushOverlay, tool, selection, marquee, moveOffset, pickStep }) {
  return (
    <>
      {brushOverlay && BRUSH_TOOLS.has(tool) && (
        <span
          className={`tl-brush-ring${tool === TOOLS.DRAG ? " is-soft" : ""}`}
          style={{
            left: brushOverlay.x,
            top: brushOverlay.y,
            width: brushOverlay.radiusX * 2,
            height: brushOverlay.radiusY * 2,
          }}
          aria-hidden="true"
        />
      )}
      {marquee && grid && (
        <SelectionBox grid={grid} rect={marquee} marquee />
      )}
      {selection && grid && !marquee && (
        <SelectionBox grid={grid} rect={selection} offset={moveOffset ?? { dr: 0, dc: 0 }} />
      )}
      {pickStep && (
        <span className="tl-pick-badge">
          from ({pickStep.row},{pickStep.col})
        </span>
      )}
    </>
  );
}

function GridCanvas({
  grid,
  label,
  maxSize = CANVAS_BASE,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  overlay,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !grid?.length) return;
    renderEditorGrid(ref.current, grid, maxSize);
  }, [grid, maxSize]);

  return (
    <div className="tl-canvas-wrap">
      <span className="tl-canvas-label">{label}</span>
      <div className="tl-canvas-inner">
        <canvas
          ref={ref}
          className="tl-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        />
        {overlay}
      </div>
    </div>
  );
}

export default function TransformLab() {
  const [avatars, setAvatars] = useState([]);
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [template, setTemplate] = useState(() => createEmptyTemplate());
  const [tool, setTool] = useState(TOOLS.LIQUEFY);
  const [brushRadius, setBrushRadius] = useState(4);
  const [dragRadius, setDragRadius] = useState(10);
  const [referenceAvatarId, setReferenceAvatarId] = useState("");
  const [previewAvatarId, setPreviewAvatarId] = useState("");
  const [slotBAvatarId, setSlotBAvatarId] = useState("");
  const [previewAvatar1Id, setPreviewAvatar1Id] = useState("");
  const [previewAvatar2Id, setPreviewAvatar2Id] = useState("");
  const [pickStep, setPickStep] = useState(null);
  const [selection, setSelection] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [moveOffset, setMoveOffset] = useState(null);
  const [status, setStatus] = useState("");
  const [brushOverlay, setBrushOverlay] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const templateRef = useRef(template);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const strokeSnapshotRef = useRef(null);
  const strokeChangedRef = useRef(false);
  const dragRef = useRef({
    active: false,
    lastPoint: null,
    pendingDr: 0,
    pendingDc: 0,
  });
  const moveRef = useRef({
    phase: null,
    anchor: null,
    startCell: null,
    lastRect: null,
    pendingDr: 0,
    pendingDc: 0,
  });

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [template.id]);

  const syncUndoRedoFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const snapshotActiveMap = useCallback(() => {
    const t = templateRef.current;
    const dual = t.slots.length > 1;
    const cur = dual ? (t.compositeSampleMap ?? []) : (t.slots[0]?.sampleMap ?? []);
    return cloneMapSnapshot(cur, dual);
  }, []);

  const restoreActiveMap = useCallback((snapshot) => {
    setTemplate((t) => {
      if (t.slots.length > 1) {
        return {
          ...t,
          compositeSampleMap: normalizeCompositeMap(cloneCompositeSampleMap(snapshot)),
          updatedAt: new Date().toISOString(),
        };
      }
      const slots = [...t.slots];
      slots[0] = { ...slots[0], sampleMap: cloneSampleMap(snapshot) };
      return { ...t, slots, updatedAt: new Date().toISOString() };
    });
  }, []);

  const pushUndo = useCallback(
    (snapshot) => {
      if (!snapshot?.length) return;
      const dual = templateRef.current.slots.length > 1;
      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
        cloneMapSnapshot(snapshot, dual),
      ];
      redoStackRef.current = [];
      syncUndoRedoFlags();
    },
    [syncUndoRedoFlags],
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    redoStackRef.current.push(snapshotActiveMap());
    restoreActiveMap(prev);
    syncUndoRedoFlags();
    setStatus("Undo");
  }, [restoreActiveMap, snapshotActiveMap, syncUndoRedoFlags]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (!stack.length) return;
    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    undoStackRef.current.push(snapshotActiveMap());
    restoreActiveMap(next);
    syncUndoRedoFlags();
    setStatus("Redo");
  }, [restoreActiveMap, snapshotActiveMap, syncUndoRedoFlags]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    fetch(`${API}/api/avatars`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list = data.avatars ?? [];
        setAvatars(list);
        if (list[0]) {
          setReferenceAvatarId((p) => p || list[0]._id);
          setPreviewAvatarId((p) => p || list[0]._id);
          setSlotBAvatarId((p) => p || (list[1]?._id ?? list[0]._id));
          setPreviewAvatar1Id((p) => p || list[0]._id);
          setPreviewAvatar2Id((p) => p || (list[1]?._id ?? list[0]._id));
        }
      })
      .catch(() => setStatus("Could not load avatars."));
  }, []);

  const avatarById = useMemo(
    () => Object.fromEntries(avatars.map((a) => [a._id, a])),
    [avatars],
  );

  const referenceGrid = avatarById[referenceAvatarId]?.avatarGrid;
  const previewGrid = avatarById[previewAvatarId]?.avatarGrid;
  const slotBGrid = avatarById[slotBAvatarId]?.avatarGrid;
  const previewGrid1 = avatarById[previewAvatar1Id]?.avatarGrid;
  const previewGrid2 = avatarById[previewAvatar2Id]?.avatarGrid;
  const isDual = template.slots.length > 1;
  const compositeSampleMap = template.compositeSampleMap ?? [];
  const singleSampleMap = template.slots[0]?.sampleMap ?? [];
  const activeSampleMap = isDual ? compositeSampleMap : singleSampleMap;
  const mapsReady = activeSampleMap.length > 0;

  const editPreviewGrid = useMemo(() => {
    if (isDual) {
      if (!compositeSampleMap.length) return null;
      return applyCompositeSampleMap(compositeSampleMap, [referenceGrid, slotBGrid]);
    }
    if (!referenceGrid?.length || !singleSampleMap.length) return null;
    return applySampleMap(referenceGrid, singleSampleMap);
  }, [isDual, compositeSampleMap, referenceGrid, slotBGrid, singleSampleMap]);

  const appliedPreviewGrid = useMemo(() => {
    if (isDual) {
      if (!compositeSampleMap.length) return null;
      return applyCompositeSampleMap(compositeSampleMap, [previewGrid1, previewGrid2]);
    }
    if (!previewGrid?.length || !singleSampleMap.length) return null;
    return applySampleMap(previewGrid, singleSampleMap);
  }, [isDual, compositeSampleMap, previewGrid1, previewGrid2, previewGrid, singleSampleMap]);

  /** Grid used for pointer + overlays (fixed transform size, not reference avatar size). */
  const overlayGrid = editPreviewGrid ?? appliedPreviewGrid;

  const editCanvasSize = useMemo(
    () => editorCanvasMaxSize(editPreviewGrid, CANVAS_BASE, CANVAS_MIN_CELL),
    [editPreviewGrid],
  );

  const previewCanvasSize = useMemo(
    () => editorCanvasMaxSize(appliedPreviewGrid, CANVAS_BASE, CANVAS_MIN_CELL),
    [appliedPreviewGrid],
  );

  useEffect(() => {
    if (!isDual) return;
    setTemplate((t) => {
      const slots = [...t.slots];
      let changed = false;

      slots.forEach((cur, i) => {
        const grid = i === 0 ? referenceGrid : slotBGrid;
        if (!grid?.length) return;
        if (cur.sampleMap?.length > 0) {
          const rows = cur.sampleMap.length;
          const cols = cur.sampleMap[0]?.length ?? 26;
          if (cur.rows !== rows || cur.cols !== cols) {
            slots[i] = { ...cur, rows, cols };
            changed = true;
          }
          return;
        }
        slots[i] = initSlotFromGrid(cur, grid);
        changed = true;
      });

      if (!slots.every((s) => s.sampleMap?.length > 0)) {
        return changed ? { ...t, slots, updatedAt: new Date().toISOString() } : t;
      }

      const compactSlots = compactDualSlotOffsets(slots);

      if (t.compositeSampleMap?.length > 0) {
        return changed
          ? { ...t, slots: compactSlots, updatedAt: new Date().toISOString() }
          : t;
      }

      const compositeSampleMap = normalizeCompositeMap(
        mergeSlotsToCompositeMap(compactSlots),
      );
      return {
        ...t,
        slots: compactSlots,
        compositeSampleMap,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [isDual, referenceGrid, slotBGrid]);

  useEffect(() => {
    if (isDual) return;
    setTemplate((t) => {
      const slots = [...t.slots];
      const cur = slots[0];
      if (!referenceGrid?.length) return t;
      if (cur.sampleMap?.length > 0) {
        const rows = cur.sampleMap.length;
        const cols = cur.sampleMap[0]?.length ?? 26;
        if (cur.rows === rows && cur.cols === cols) return t;
        slots[0] = { ...cur, rows, cols };
        return { ...t, slots, updatedAt: new Date().toISOString() };
      }
      slots[0] = initSlotFromGrid(cur, referenceGrid);
      return { ...t, slots, updatedAt: new Date().toISOString() };
    });
  }, [isDual, referenceGrid]);

  const updateActiveSampleMap = useCallback(
    (nextOrFn) => {
      setTemplate((t) => {
        if (t.slots.length > 1) {
          const cur = t.compositeSampleMap ?? [];
          const raw =
            typeof nextOrFn === "function" ? nextOrFn(cur) : nextOrFn;
          if (raw == null) return t;
          const nextMap = normalizeCompositeMap(raw);
          if (!nextMap.length) return t;
          return {
            ...t,
            compositeSampleMap: nextMap,
            updatedAt: new Date().toISOString(),
          };
        }
        const slots = [...t.slots];
        const cur = slots[0];
        const nextMap =
          typeof nextOrFn === "function" ? nextOrFn(cur.sampleMap) : nextOrFn;
        slots[0] = { ...cur, sampleMap: nextMap };
        return { ...t, slots, updatedAt: new Date().toISOString() };
      });
    },
    [],
  );

  const resetBrushDrag = useCallback(() => {
    dragRef.current = {
      active: false,
      lastPoint: null,
      pendingDr: 0,
      pendingDc: 0,
    };
  }, []);

  const applyBrushStroke = useCallback(
    (point, stroke, radius, minStep) => {
      const drag = dragRef.current;
      if (!drag.active || !drag.lastPoint) return false;

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

      updateActiveSampleMap((prev) =>
        stroke(prev, point.row, point.col, dr, dc, radius),
      );
      return true;
    },
    [updateActiveSampleMap],
  );

  const activeBrushRadius = tool === TOOLS.DRAG ? dragRadius : brushRadius;

  const updateBrushOverlay = useCallback(
    (e) => {
      if (!BRUSH_TOOLS.has(tool) || !editPreviewGrid?.length) {
        setBrushOverlay(null);
        return;
      }
      const overlay = brushOverlayFromPointer(
        e.currentTarget,
        editPreviewGrid,
        e.clientX,
        e.clientY,
        activeBrushRadius,
      );
      setBrushOverlay(overlay);
    },
    [tool, editPreviewGrid, activeBrushRadius],
  );

  useEffect(() => {
    if (!BRUSH_TOOLS.has(tool)) setBrushOverlay(null);
    if (tool !== TOOLS.MOVE) {
      setMarquee(null);
      setMoveOffset(null);
      moveRef.current = {
        phase: null,
        anchor: null,
        startCell: null,
        lastRect: null,
        pendingDr: 0,
        pendingDc: 0,
      };
    }
  }, [tool]);

  const cellInRect = (cell, rect) =>
    cell.row >= rect.r0 &&
    cell.row <= rect.r1 &&
    cell.col >= rect.c0 &&
    cell.col <= rect.c1;

  const handleCanvasPointer = useCallback(
    (e, phase) => {
      const pickGrid = overlayGrid;
      if (!pickGrid?.length || !mapsReady) return;
      const canvas = e.currentTarget;
      const point = gridPointFromPointer(canvas, pickGrid, e.clientX, e.clientY);
      const cell = gridCellFromPointer(canvas, pickGrid, e.clientX, e.clientY);

      const liquefy = (prev, r, c, dr, dc, rad) =>
        isDual
          ? unifiedLiquefyStroke(prev, template.slots, r, c, dr, dc, rad)
          : liquefyStroke(prev, r, c, dr, dc, rad);
      const drag = (prev, r, c, dr, dc, rad) =>
        isDual
          ? unifiedDragStroke(prev, template.slots, r, c, dr, dc, rad)
          : dragStroke(prev, r, c, dr, dc, rad);

      if (tool === TOOLS.LIQUEFY || tool === TOOLS.DRAG) {
        if (!point) {
          if (phase === "up" || phase === "cancel") resetBrushDrag();
          return;
        }

        const radius = tool === TOOLS.DRAG ? dragRadius : brushRadius;
        const stroke = tool === TOOLS.DRAG ? drag : liquefy;
        const minStep = BRUSH_STEP[tool];

        if (phase === "down") {
          strokeSnapshotRef.current = snapshotActiveMap();
          strokeChangedRef.current = false;
          dragRef.current = {
            active: true,
            lastPoint: point,
            pendingDr: 0,
            pendingDc: 0,
          };
          return;
        }

        if (phase === "move" && dragRef.current.active) {
          if (!point) return;
          if (applyBrushStroke(point, stroke, radius, minStep)) {
            strokeChangedRef.current = true;
          }
          return;
        }

        if (phase === "up" || phase === "cancel") {
          if (dragRef.current.active && point) {
            if (applyBrushStroke(point, stroke, radius, minStep)) {
              strokeChangedRef.current = true;
            }
            if (dragRef.current.pendingDr || dragRef.current.pendingDc) {
              if (applyBrushStroke(point, stroke, radius, minStep * 0.35)) {
                strokeChangedRef.current = true;
              }
            }
          }
          if (strokeChangedRef.current && strokeSnapshotRef.current) {
            pushUndo(strokeSnapshotRef.current);
          }
          strokeSnapshotRef.current = null;
          strokeChangedRef.current = false;
          resetBrushDrag();
        }
        return;
      }

      if (tool === TOOLS.MOVE) {
        if (phase === "down") {
          if (!cell) return;
          if (selection && cellInRect(cell, selection) && !marquee) {
            moveRef.current = {
              phase: "moving",
              anchor: selection,
              startCell: cell,
              lastRect: selection,
              pendingDr: 0,
              pendingDc: 0,
            };
            setMoveOffset({ dr: 0, dc: 0 });
            setStatus("Drag to move selection");
            return;
          }
          moveRef.current = {
            phase: "selecting",
            anchor: cell,
            startCell: cell,
            lastRect: normalizeRect(cell.row, cell.col, cell.row, cell.col),
            pendingDr: 0,
            pendingDc: 0,
          };
          setSelection(null);
          setMoveOffset(null);
          setMarquee(moveRef.current.lastRect);
          setStatus("Drag to select region");
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
            moveRef.current.anchor &&
            moveRef.current.startCell &&
            cell
          ) {
            const { startCell } = moveRef.current;
            const dr = cell.row - startCell.row;
            const dc = cell.col - startCell.col;
            moveRef.current.pendingDr = dr;
            moveRef.current.pendingDc = dc;
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
              setStatus(
                `Selected (${box.r0},${box.c0})–(${box.r1},${box.c1}). Drag inside to move.`,
              );
            }
          } else if (moveRef.current.phase === "moving" && moveRef.current.anchor) {
            const { anchor, startCell } = moveRef.current;
            const dr = Math.round(
              cell && startCell ? cell.row - startCell.row : moveRef.current.pendingDr,
            );
            const dc = Math.round(
              cell && startCell ? cell.col - startCell.col : moveRef.current.pendingDc,
            );
            if (dr || dc) {
              pushUndo(snapshotActiveMap());
              updateActiveSampleMap((prev) =>
                moveSampleRegion(
                  prev,
                  anchor,
                  dr,
                  dc,
                  isDual ? ERASED_SAMPLE : undefined,
                ),
              );
              setSelection(translateRect(anchor, dr, dc));
              setStatus(`Moved selection by (${dr}, ${dc})`);
            }
            setMoveOffset(null);
          }
          moveRef.current = {
            phase: null,
            anchor: null,
            startCell: null,
            lastRect: null,
            pendingDr: 0,
            pendingDc: 0,
          };
        }
        return;
      }

      if (phase !== "down" || !cell) return;

      if (tool === TOOLS.ERASE) {
        pushUndo(snapshotActiveMap());
        updateActiveSampleMap((prev) =>
          isDual
            ? unifiedClearSampleCell(prev, cell.row, cell.col)
            : clearSampleCell(prev, cell.row, cell.col),
        );
        setStatus(`Cleared (${cell.row},${cell.col})`);
        return;
      }

      if (tool === TOOLS.COPY) {
        if (!pickStep) {
          setPickStep({ row: cell.row, col: cell.col });
          setStatus(
            `Copy: picked source (${cell.row},${cell.col}) — click destination`,
          );
          return;
        }
        pushUndo(snapshotActiveMap());
        updateActiveSampleMap((prev) =>
          isDual
            ? unifiedCopySampleCell(
                prev,
                pickStep.row,
                pickStep.col,
                cell.row,
                cell.col,
              )
            : copySampleCell(
                prev,
                pickStep.row,
                pickStep.col,
                cell.row,
                cell.col,
              ),
        );
        setPickStep(null);
        setStatus(
          `Copied (${pickStep.row},${pickStep.col}) → (${cell.row},${cell.col})`,
        );
        return;
      }
    },
    [
      overlayGrid,
      mapsReady,
      template.slots,
      isDual,
      tool,
      brushRadius,
      dragRadius,
      pickStep,
      selection,
      marquee,
      updateActiveSampleMap,
      applyBrushStroke,
      resetBrushDrag,
      snapshotActiveMap,
      pushUndo,
    ],
  );

  const saveCurrentTemplate = () => {
    const synced = templateWithSyncedSlots(template);
    const toSave =
      synced.slots.length > 1 && template.compositeSampleMap?.length
        ? { ...synced, compositeSampleMap: template.compositeSampleMap }
        : synced;
    const next = [...templates.filter((t) => t.id !== toSave.id), toSave];
    saveTemplates(next);
    setTemplates(next);
    setTemplate(toSave);
    setStatus(`Saved “${toSave.name}” locally`);
  };

  const loadTemplate = (t) => {
    setTemplate(t.slots.length > 1 ? prepareDualTemplate(t) : {
      ...t,
      slots: t.slots.map((s) => ({
        ...s,
        sampleMap: cloneSampleMap(s.sampleMap),
      })),
    });
    setStatus(`Loaded “${t.name}”`);
  };

  const newSingleTemplate = () => {
    setTemplate(createEmptyTemplate());
    setStatus("New single-character template");
  };

  const newDualTemplate = () => {
    setTemplate(createDualSlotTemplate());
    setStatus("Two characters on one canvas — edit like a single image");
  };

  const resetMaps = () => {
    pushUndo(snapshotActiveMap());
    setTemplate((t) => {
      if (t.slots.length > 1) {
        const compositeSampleMap = resetCompositeSampleMap(t.slots);
        return {
          ...t,
          compositeSampleMap: normalizeCompositeMap(compositeSampleMap),
          updatedAt: new Date().toISOString(),
        };
      }
      const rows = t.slots[0].sampleMap.length;
      const cols = t.slots[0].sampleMap[0]?.length ?? 26;
      const slots = [...t.slots];
      slots[0] = {
        ...slots[0],
        sampleMap: resetSampleMap(rows, cols),
      };
      return { ...t, slots, updatedAt: new Date().toISOString() };
    });
    setSelection(null);
    setMarquee(null);
    setMoveOffset(null);
    setStatus(isDual ? "Reset both character maps" : "Reset slot map to identity");
  };

  const exportJson = () => {
    const blob = new Blob([exportTemplateJson(template)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-").toLowerCase() || "pose"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const t = importTemplateJson(reader.result);
        setTemplate(
          t.slots.length > 1
            ? prepareDualTemplate(t)
            : {
                ...t,
                slots: t.slots.map((s) => ({
                  ...s,
                  sampleMap: cloneSampleMap(s.sampleMap),
                })),
              },
        );
        setTemplates((prev) => {
          const next = [...prev, t];
          saveTemplates(next);
          return next;
        });
        setStatus(`Imported “${t.name}”`);
      } catch {
        setStatus("Invalid template JSON");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="tl-page">
      <header className="tl-header">
        <div>
          <p className="tl-kicker">Experimental · no DB changes</p>
          <h1 className="tl-title">Transform Lab</h1>
          <p className="tl-desc">
            Edit a <strong>sample map</strong> (which source cell each output cell reads). The
            same transform applies to any avatar with the same grid size.
          </p>
        </div>
        <Link to="/" className="tl-back">
          ← Back
        </Link>
      </header>

      <div className="tl-toolbar">
        <PixelBox variant="retro" className="tl-panel">
          <div className="tl-panel-title">Tool</div>
          <div className="tl-tool-row">
            {[
              [TOOLS.LIQUEFY, "Liquefy"],
              [TOOLS.DRAG, "Drag"],
              [TOOLS.COPY, "Copy"],
              [TOOLS.MOVE, "Move"],
              [TOOLS.ERASE, "Erase"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tl-btn${tool === id ? " is-active" : ""}`}
                onClick={() => {
                  setTool(id);
                  setPickStep(null);
                  if (id !== TOOLS.MOVE) setSelection(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {tool === TOOLS.LIQUEFY && (
            <label className="tl-slider-label">
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
          {tool === TOOLS.DRAG && (
            <>
              <label className="tl-slider-label">
                Influence radius: {dragRadius} cells
                <input
                  type="range"
                  min={3}
                  max={18}
                  value={dragRadius}
                  onChange={(e) => setDragRadius(Number(e.target.value))}
                />
              </label>
              <p className="tl-hint">
                Orange ring = full influence area. Softer pull than Liquefy inside the ring.
                {isDual &&
                  " Drag pulls pixels across the whole canvas, including between both characters."}
              </p>
            </>
          )}
          {tool === TOOLS.MOVE && (
            <p className="tl-hint">
              Drag to select a region, then drag inside the box to move it.
              {isDual &&
                " Avatar 1 pixels can overlap Avatar 2 — they stay visible and keep Avatar 1 colors."}
            </p>
          )}
          {tool === TOOLS.COPY && (
            <p className="tl-hint">
              Click source cell, then destination. In dual mode, copy works across both
              characters — pasted pixels keep their original avatar colors.
            </p>
          )}
          <div className="tl-btn-row">
            <button type="button" className="tl-btn" onClick={undo} disabled={!canUndo}>
              Undo
            </button>
            <button type="button" className="tl-btn" onClick={redo} disabled={!canRedo}>
              Redo
            </button>
          </div>
          <p className="tl-hint">⌘Z undo · ⇧⌘Z redo</p>
          <button type="button" className="tl-btn" onClick={resetMaps}>
            {isDual ? "Reset both maps" : "Reset slot map"}
          </button>
        </PixelBox>

        <PixelBox variant="retro" className="tl-panel">
          <div className="tl-panel-title">Template</div>
          <input
            className="tl-input"
            value={template.name}
            onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
          />
          <div className="tl-btn-row">
            <button type="button" className="tl-btn" onClick={newSingleTemplate}>
              1 character
            </button>
            <button type="button" className="tl-btn" onClick={newDualTemplate}>
              2 characters
            </button>
          </div>
          <div className="tl-btn-row">
            <button type="button" className="tl-btn tl-btn-primary" onClick={saveCurrentTemplate}>
              Save local
            </button>
            <button type="button" className="tl-btn" onClick={exportJson}>
              Export JSON
            </button>
            <label className="tl-btn tl-file">
              Import
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
              />
            </label>
          </div>
          {templates.length > 0 && (
            <ul className="tl-template-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" className="tl-link" onClick={() => loadTemplate(t)}>
                    {t.name}
                  </button>
                  <span className="tl-meta">{t.slots.length} slot(s)</span>
                </li>
              ))}
            </ul>
          )}
        </PixelBox>

        <PixelBox variant="retro" className="tl-panel">
          <div className="tl-panel-title">Avatars</div>
          {isDual ? (
            <>
              <label className="tl-field">
                Avatar 1
                <select
                  value={referenceAvatarId}
                  onChange={(e) => setReferenceAvatarId(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tl-field">
                Avatar 2
                <select
                  value={slotBAvatarId}
                  onChange={(e) => setSlotBAvatarId(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="tl-hint">
                One shared canvas — Move/Liquefy/Drag work across both characters, like a single image.
              </p>
              <label className="tl-field">
                Preview Avatar 1
                <select
                  value={previewAvatar1Id}
                  onChange={(e) => setPreviewAvatar1Id(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tl-field">
                Preview Avatar 2
                <select
                  value={previewAvatar2Id}
                  onChange={(e) => setPreviewAvatar2Id(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="tl-hint">
                Preview uses the same pose on different avatars — edits are not reset.
              </p>
            </>
          ) : (
            <>
              <label className="tl-field">
                Reference (edit map)
                <select
                  value={referenceAvatarId}
                  onChange={(e) => setReferenceAvatarId(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tl-field">
                Preview (apply transform)
                <select
                  value={previewAvatarId}
                  onChange={(e) => setPreviewAvatarId(e.target.value)}
                >
                  {avatars.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </PixelBox>
      </div>

      <div className="tl-stage">
        <GridCanvas
          label={isDual ? "Edit (both characters)" : "Edit (reference + sample map)"}
          grid={editPreviewGrid}
          maxSize={editCanvasSize}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateBrushOverlay(e);
            handleCanvasPointer(e, "down");
          }}
          onPointerMove={(e) => {
            updateBrushOverlay(e);
            handleCanvasPointer(e, "move");
          }}
          onPointerUp={(e) => {
            handleCanvasPointer(e, "up");
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            updateBrushOverlay(e);
          }}
          onPointerCancel={(e) => {
            handleCanvasPointer(e, "cancel");
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            setBrushOverlay(null);
          }}
          onPointerLeave={(e) => {
            if (!dragRef.current.active) setBrushOverlay(null);
          }}
          overlay={
            <CanvasOverlays
              grid={overlayGrid}
              brushOverlay={brushOverlay}
              tool={tool}
              selection={selection}
              marquee={marquee}
              moveOffset={moveOffset}
              pickStep={pickStep}
            />
          }
        />
        <GridCanvas
          label={
            isDual
              ? "Preview (both characters, any avatars)"
              : "Preview (any avatar)"
          }
          grid={appliedPreviewGrid}
          maxSize={previewCanvasSize}
          overlay={
            <CanvasOverlays
              grid={appliedPreviewGrid}
              tool={tool}
              selection={selection}
              marquee={marquee}
              moveOffset={moveOffset}
            />
          }
        />
      </div>

      {status && <p className="tl-status">{status}</p>}

      <PixelBox variant="retro" className="tl-notes">
        <p>
          <strong>How it works:</strong> each output cell stores <code>[sourceRow, sourceCol]</code>.
          Liquefy shifts those pointers sharply. Drag kneads with a wider, softer pull.
          Copy/Move remap cells. Saved templates live in{" "}
          <code>localStorage</code> only — MongoDB avatars are never modified.
        </p>
      </PixelBox>
    </div>
  );
}
