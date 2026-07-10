import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RoomScene from "../live/RoomScene";
import {
  BG_SRC,
  BG_HEIGHT_PCT,
  BG_OFFSET_X_REF,
  BG_OFFSET_Y_REF,
  CANVAS_REF_H,
  CANVAS_REF_W,
} from "../live/roomConfig";
import { layoutFieldsForFurniture } from "./furnitureLayoutFields";
import { normalizeDeskLayout, setLayoutValue } from "../live/furniture/normalizeDeskLayout";
import { layoutForEditing } from "../live/furniture/normalizeFurnitureLayout";
import { buildLabPreviewLayout } from "./furnitureLabPreview";
import {
  clearEditDraft,
  layoutsEqual,
  loadEditDraft,
  migrateLabStorage,
  saveEditDraft,
} from "./furnitureLabStorage";
import FurnitureCreateWizard from "./FurnitureCreateWizard";
import LayoutTunePanel from "./LayoutTunePanel";
import FurnitureImageReupload from "./FurnitureImageReupload";
import PreviewCharacterPickers from "./PreviewCharacterPickers";
import "../../styles/FurnitureLab.css";

const API = import.meta.env.VITE_API_URL;
const PREVIEW_HEIGHT = 400;

const noop = () => {};

function cloneLayout(layout = {}) {
  return JSON.parse(JSON.stringify(layout));
}

export default function FurnitureLab() {
  const wrapRef = useRef(null);
  const [mode, setMode] = useState("edit");
  const [canvasW, setCanvasW] = useState(0);
  const [furnitures, setFurnitures] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [previewAvatarBySlot, setPreviewAvatarBySlot] = useState({ 0: "", 1: "" });
  const [selectedKey, setSelectedKey] = useState("bean_bag");
  const [draftLayout, setDraftLayout] = useState({});
  const [previewPosition, setPreviewPosition] = useState("left");
  const [createDraft, setCreateDraft] = useState(null);
  const [createPreviewSide, setCreatePreviewSide] = useState("left");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [assetVersion, setAssetVersion] = useState(0);
  const [previewRoomContext, setPreviewRoomContext] = useState(false);

  useEffect(() => {
    migrateLabStorage();
  }, []);

  const selected = useMemo(
    () => furnitures.find((f) => f.key === selectedKey) ?? null,
    [furnitures, selectedKey],
  );

  const avatarById = useMemo(
    () => Object.fromEntries(avatars.map((a) => [a._id, a])),
    [avatars],
  );

  const previewSlotCount = useMemo(() => {
    if (mode === "create") {
      return Math.max(1, createDraft?.capacity ?? 1);
    }
    return Math.max(1, selected?.capacity ?? 1);
  }, [mode, selected, createDraft]);

  const setPreviewAvatarForSlot = useCallback((slotIndex, avatarId) => {
    setPreviewAvatarBySlot((prev) => ({ ...prev, [slotIndex]: avatarId }));
  }, []);

  const loadData = useCallback(async () => {
    const [fRes, aRes] = await Promise.all([
      fetch(`${API}/api/furnitures`, { credentials: "include" }),
      fetch(`${API}/api/avatars`, { credentials: "include" }),
    ]);
    const fList = fRes.ok ? await fRes.json() : [];
    const avatarPayload = aRes.ok ? await aRes.json() : { avatars: [] };
    const avatarList = avatarPayload.avatars ?? [];
    setFurnitures(fList);
    setAvatars(avatarList);
    const initialAvatar =
      avatarList.find((a) => a.isDefault) ??
      avatarList.find((a) => String(a._id) === String(avatarPayload.activeAvatarId)) ??
      avatarList[0] ??
      null;
    if (initialAvatar) {
      setPreviewAvatarBySlot({ 0: initialAvatar._id, 1: initialAvatar._id });
    }
    if (fList.length > 0) {
      const initial = fList.find((f) => f.key === "bean_bag") ?? fList[0];
      setSelectedKey(initial.key);
      setDraftLayout(cloneLayout(layoutForEditing(initial)));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadData();
      } catch {
        if (!cancelled) setStatus("Could not load furnitures.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (mode !== "edit") return;
    const f = furnitures.find((item) => item.key === selectedKey);
    if (!f) return;
    const local = loadEditDraft(selectedKey);
    const sourceLayout = local?.layout ?? f.layout;
    setDraftLayout(cloneLayout(layoutForEditing(f, sourceLayout)));
    setPreviewRoomContext(f.zSlot === "char-middle");
    if (local?.layout) {
      setStatus("Restored unsaved local edits.");
    } else {
      setStatus("");
    }
  }, [selectedKey, mode, furnitures]);

  const serverLayout = useMemo(
    () => (selected ? layoutForEditing(selected) : null),
    [selected],
  );

  const canonicalDraftLayout = useMemo(() => {
    if (!selected || mode !== "edit") return draftLayout;
    if (selected.slotType === "center" || selected.key === "desk") {
      return normalizeDeskLayout(draftLayout, selected.capacity ?? 2);
    }
    return layoutForEditing(selected, draftLayout);
  }, [selected, draftLayout, mode]);

  useEffect(() => {
    if (mode !== "edit" || !selectedKey || !selected || !serverLayout) return;
    if (layoutsEqual(canonicalDraftLayout, serverLayout)) {
      clearEditDraft(selectedKey);
      return;
    }
    saveEditDraft(selectedKey, canonicalDraftLayout);
  }, [canonicalDraftLayout, selectedKey, selected, serverLayout, mode]);

  const hasUnsavedEdits =
    mode === "edit" &&
    selected &&
    serverLayout &&
    !layoutsEqual(canonicalDraftLayout, serverLayout);

  useEffect(() => {
    if (loading) return undefined;
    const el = wrapRef.current;
    if (!el) return undefined;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setCanvasW(w);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, mode]);

  const canvasH = PREVIEW_HEIGHT;
  const sceneScale = canvasH / CANVAS_REF_H;
  const effectiveCanvasW =
    canvasW > 0
      ? canvasW
      : Math.round(canvasH * (CANVAS_REF_W / CANVAS_REF_H));

  const previewFurniture = useMemo(() => {
    if (mode === "create") return createDraft;
    if (!selected) return null;
    return {
      ...selected,
      layout: canonicalDraftLayout,
      _assetV: assetVersion,
    };
  }, [mode, createDraft, selected, canonicalDraftLayout, assetVersion]);

  const isCenterMultiSeat = previewFurniture?.slotType === "center";

  const previewFurnitures = useMemo(() => {
    if (!previewFurniture) return furnitures;
    const exists = furnitures.some((f) => f.key === previewFurniture.key);
    if (exists) {
      return furnitures.map((f) =>
        f.key === previewFurniture.key ? previewFurniture : f,
      );
    }
    return [...furnitures, previewFurniture];
  }, [furnitures, previewFurniture]);

  const previewMembersBySlot = useMemo(() => {
    const buildMember = (avatarId) => {
      const avatar = avatarId ? avatarById[avatarId] ?? null : null;
      return {
        isOnline: true,
        activeAvatar: avatar
          ? {
              avatarGrid: avatar.avatarGrid,
              avatarCuts: avatar.avatarCuts,
            }
          : null,
      };
    };
    const members = {};
    for (let slotIndex = 0; slotIndex < previewSlotCount; slotIndex += 1) {
      const avatarId =
        previewAvatarBySlot[slotIndex] ?? previewAvatarBySlot[0] ?? "";
      members[slotIndex] = buildMember(avatarId);
    }
    return members;
  }, [previewAvatarBySlot, avatarById, previewSlotCount]);

  const activePreviewSide =
    mode === "create" ? createPreviewSide : previewPosition;

  const previewUsesRoomContext = useMemo(() => {
    if (isCenterMultiSeat) return true;
    if (mode === "create") {
      return createDraft?.zSlot === "char-middle";
    }
    return previewRoomContext;
  }, [isCenterMultiSeat, mode, createDraft, previewRoomContext]);

  const previewLayout = useMemo(() => {
    if (!previewFurniture) return [];
    return buildLabPreviewLayout({
      activeFurniture: previewFurniture,
      activePosition: isCenterMultiSeat ? "center" : activePreviewSide,
      previewMembersBySlot,
      catalogFurnitures: furnitures,
      isCenterMultiSeat,
      roomContext: previewUsesRoomContext,
    });
  }, [
    previewFurniture,
    previewMembersBySlot,
    furnitures,
    isCenterMultiSeat,
    activePreviewSide,
    previewUsesRoomContext,
  ]);

  const fields = selected ? layoutFieldsForFurniture(selected) : [];

  const updateField = useCallback((path, value) => {
    setDraftLayout((prev) => {
      const base =
        selectedKey === "desk" || selected?.slotType === "center"
          ? normalizeDeskLayout(prev, selected?.capacity ?? 2)
          : selected
            ? layoutForEditing(selected, prev)
            : prev;
      return setLayoutValue(base, path, value);
    });
    setStatus("");
  }, [selectedKey, selected]);

  const resetLayout = useCallback(() => {
    if (!selected || !serverLayout) return;
    setDraftLayout(cloneLayout(serverLayout));
    clearEditDraft(selectedKey);
    setStatus("Reset to last saved server values.");
  }, [selected, selectedKey, serverLayout]);

  const copyLayout = useCallback(async () => {
    const text = JSON.stringify(
      mode === "create" ? createDraft?.layout : draftLayout,
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Layout JSON copied.");
    } catch {
      setStatus(text);
    }
  }, [mode, createDraft, draftLayout]);

  const saveLayout = useCallback(async () => {
    if (!selectedKey) return;
    setStatus("Saving…");
    try {
      const res = await fetch(`${API}/api/furnitures/${selectedKey}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: canonicalDraftLayout }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFurnitures((prev) =>
        prev.map((f) => (f.key === selectedKey ? { ...f, layout: data.layout } : f)),
      );
      clearEditDraft(selectedKey);
      setStatus("Uploaded to server.");
    } catch (err) {
      setStatus(err.message || "Save failed.");
    }
  }, [selectedKey, canonicalDraftLayout]);

  const deleteFurniture = useCallback(async () => {
    if (!selected || selected.isDefault) return;
    const ok = window.confirm(
      `Delete "${selected.name}" (${selected.key}) from the server? This removes its PNG files too.`,
    );
    if (!ok) return;
    setStatus("Deleting…");
    try {
      const res = await fetch(`${API}/api/furnitures/${selectedKey}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      clearEditDraft(selectedKey);
      const remaining = furnitures.filter((f) => f.key !== selectedKey);
      setFurnitures(remaining);
      const next = remaining.find((f) => f.key === "bean_bag") ?? remaining[0];
      if (next) {
        setSelectedKey(next.key);
        setDraftLayout(cloneLayout(layoutForEditing(next)));
      }
      setStatus(`Deleted ${selectedKey}.`);
    } catch (err) {
      setStatus(err.message || "Delete failed.");
    }
  }, [selected, selectedKey, furnitures]);

  const handleCreateDraft = useCallback((furniture, side) => {
    setCreateDraft(furniture);
    setCreatePreviewSide(side ?? "left");
  }, []);

  const handleCreated = useCallback(
    (furniture) => {
      setFurnitures((prev) => [...prev, furniture]);
      setSelectedKey(furniture.key);
      setDraftLayout(cloneLayout(layoutForEditing(furniture)));
      setMode("edit");
      setCreateDraft(null);
      setStatus(`Created ${furniture.name}.`);
    },
    [],
  );

  const bg = useMemo(
    () => ({
      src: BG_SRC,
      heightPct: BG_HEIGHT_PCT,
      offsetX: BG_OFFSET_X_REF,
      offsetY: BG_OFFSET_Y_REF,
    }),
    [],
  );

  const jsonPreview =
    mode === "create" ? createDraft?.layout : canonicalDraftLayout;

  const previewSection = (
    <>
      <div className="fl-canvas-wrap">
        <span className="fl-canvas-label">
          Preview · {Math.round(effectiveCanvasW)}×{canvasH}px canvas
          {!previewFurniture && mode === "create"
            ? " · upload images to preview"
            : ""}
        </span>
        <div
          ref={wrapRef}
          className="fl-canvas-inner"
          style={{ height: canvasH, width: "100%" }}
        >
          {previewLayout.length > 0 && (
            <RoomScene
              layout={previewLayout}
              furnitures={previewFurnitures}
              canvasW={effectiveCanvasW}
              canvasH={canvasH}
              sceneScale={sceneScale}
              cameraX={0}
              bg={bg}
              selfUserId="preview"
              onSelectTarget={noop}
              onAction={noop}
              onPendingTimeout={noop}
            />
          )}
        </div>
      </div>
      <PreviewCharacterPickers
        avatars={avatars}
        previewAvatarBySlot={previewAvatarBySlot}
        onPreviewAvatarChange={setPreviewAvatarForSlot}
        previewSlotCount={previewSlotCount}
      />
    </>
  );

  return (
    <main className="main">
      <div className="main-inner">
      <header className="fl-header">
        <div>
          <p className="fl-kicker">Dev Lab</p>
          <h1 className="fl-title">Furniture Lab</h1>
          <p className="fl-desc">
            Tune layout locally in the browser; nothing hits the server until you save.
            Ref canvas {CANVAS_REF_W}×{CANVAS_REF_H}px.
          </p>
        </div>
        <Link className="fl-back" to="/rooms">
          ← Back
        </Link>
      </header>

      <div className="fl-mode-tabs">
        <button
          type="button"
          className={`fl-btn${mode === "edit" ? " is-active" : ""}`}
          onClick={() => {
            setCreateDraft(null);
            setMode("edit");
          }}
        >
          Edit existing
        </button>
        <button
          type="button"
          className={`fl-btn${mode === "create" ? " is-active" : ""}`}
          onClick={() => setMode("create")}
        >
          Create new
        </button>
      </div>

      {loading ? (
        <p className="fl-status">Loading…</p>
      ) : (
        <>
          {mode === "edit" && hasUnsavedEdits && (
            <p className="fl-local-badge">Local edits · not on server yet</p>
          )}
          {mode === "create" && createDraft && (
            <p className="fl-local-badge">Local preview · not on server yet</p>
          )}

          {mode === "edit" ? (
            <section className="fl-panel fl-toolbar-single">
              <div className="fl-panel-title">Furniture</div>
              <p className="fl-local-note">
                Sliders update local preview only. Use Save when ready to push to the
                server.
              </p>
              <label className="fl-field">
                Type
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                  {furnitures.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name} ({f.key})
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <p className="fl-meta">
                  {selected.zSlot} · {selected.slotType} · capacity {selected.capacity}
                </p>
              )}
              {!isCenterMultiSeat && (
                <>
                  <label className="fl-field fl-field-check">
                    <input
                      type="checkbox"
                      checked={previewRoomContext}
                      onChange={(e) => setPreviewRoomContext(e.target.checked)}
                    />
                    Show room context (desk + bed placeholders)
                  </label>
                  <label className="fl-field">
                    Preview side
                    <select
                      value={previewPosition}
                      onChange={(e) => setPreviewPosition(e.target.value)}
                    >
                      <option value="left">Left slot</option>
                      {previewRoomContext && (
                        <option value="center">Center slot (between beds)</option>
                      )}
                      <option value="right">Right slot</option>
                    </select>
                  </label>
                </>
              )}
            </section>
          ) : (
            <FurnitureCreateWizard
              onCreated={handleCreated}
              onDraftChange={handleCreateDraft}
              onStatus={setStatus}
              previewSection={previewSection}
            />
          )}

          {mode === "edit" && (
            <div className="fl-workbench">
              <div className="fl-workbench-canvas">{previewSection}</div>

              <section className="fl-panel fl-panel-sliders fl-workbench-sliders">
                <FurnitureImageReupload
                  furniture={selected}
                  assetVersion={assetVersion}
                  onStatus={setStatus}
                  onUploaded={(updated) => {
                    setFurnitures((prev) =>
                      prev.map((f) =>
                        f.key === updated.key ? { ...f, imageKeys: updated.imageKeys } : f,
                      ),
                    );
                    setAssetVersion(Date.now());
                  }}
                />
                <LayoutTunePanel
                  fields={fields}
                  furniture={selected}
                  draftLayout={draftLayout}
                  isCenter={selected?.slotType === "center"}
                  capacity={selected?.capacity ?? 2}
                  onFieldChange={updateField}
                  footer={
                    <div className="fl-btn-row">
                      <button type="button" className="fl-btn" onClick={resetLayout}>
                        Reset
                      </button>
                      <button type="button" className="fl-btn" onClick={copyLayout}>
                        Copy JSON
                      </button>
                      <button
                        type="button"
                        className="fl-btn fl-btn-primary"
                        onClick={saveLayout}
                        disabled={!hasUnsavedEdits}
                      >
                        Save & upload to server
                      </button>
                      {selected && !selected.isDefault && (
                        <button
                          type="button"
                          className="fl-btn fl-btn-danger"
                          onClick={deleteFurniture}
                        >
                          Delete furniture
                        </button>
                      )}
                    </div>
                  }
                />
              </section>
            </div>
          )}

          {jsonPreview && (
            <pre className="fl-json">{JSON.stringify(jsonPreview, null, 2)}</pre>
          )}
        </>
      )}

      {status && <p className="fl-status">{status}</p>}
      </div>
    </main>
  );
}
