import { useState, useRef, useEffect, useCallback } from "react";
import {
  imageToRawGrid,
  autoRemoveBackground,
  renderStatic,
  startAnimation,
  defaultCuts,
  DEFAULT_ANIM_CONFIG,
  DEFAULT_BG_TOLERANCE,
  MIN_BG_TOLERANCE,
  MAX_BG_TOLERANCE,
  BG_TOLERANCE_STEP,
} from "../utils/pixelChar";
import { useConfirm } from "./ConfirmModal";
import PixelGridEditor from "./PixelGridEditor";
import "../styles/AvatarStudio.css";

const API = import.meta.env.VITE_API_URL;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function isAcceptedImageFile(file) {
  if (!file) return false;
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function AvatarUploadZone({ imageSrc, onImageLoad, onReject }) {
  const inputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [dragState, setDragState] = useState("idle"); // idle | over | reject

  const applyFile = useCallback(
    async (file) => {
      if (!isAcceptedImageFile(file)) {
        setDragState("reject");
        onReject?.("Please upload a PNG, JPG, WebP, or GIF image.");
        window.setTimeout(() => setDragState("idle"), 700);
        return;
      }
      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        onImageLoad(dataUrl);
        setDragState("idle");
      } catch {
        onReject?.("Could not read that file.");
      }
    },
    [onImageLoad, onReject],
  );

  const hasFiles = (dt) => dt?.types?.includes("Files");

  const isDragAcceptable = (dt) => {
    const item = dt?.items?.[0];
    if (!item || item.kind !== "file") return true;
    if (!item.type) return true;
    return ACCEPTED_IMAGE_TYPES.has(item.type);
  };

  const onDragEnter = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragState(isDragAcceptable(e.dataTransfer) ? "over" : "reject");
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragState("idle");
  };

  const onDragOver = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isDragAcceptable(e.dataTransfer) ? "copy" : "none";
  };

  const onDrop = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    applyFile(file);
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    applyFile(file);
    e.target.value = "";
  };

  const openPicker = () => inputRef.current?.click();

  const zoneClass = [
    "as-upload-zone",
    dragState === "over" ? "is-drag-over" : "",
    dragState === "reject" ? "is-drag-reject" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={zoneClass}
      onClick={openPicker}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload pixel character image"
    >
      {imageSrc ? (
        <img src={imageSrc} alt="Uploaded character source" />
      ) : (
        <span className="as-upload-hint">
          Click to upload your pixel character image
          <br />
          (PNG / JPG)
        </span>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        ref={inputRef}
        onChange={onInputChange}
        className="as-upload-input"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

// Small canvas preview for thumbnails in the list
function AvatarThumb({ grid, size = 80 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && grid) renderStatic(ref.current, grid, size);
  }, [grid, size]);
  return <canvas ref={ref} />;
}

// Animated preview
function AvatarAnimPreview({ grid, cuts, size = 180 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !grid) return;
    const cfg = { ...DEFAULT_ANIM_CONFIG, cuts };
    const stop = startAnimation(ref.current, grid, cfg, size);
    return stop;
  }, [grid, cuts, size]);
  return <canvas ref={ref} />;
}

export default function AvatarStudio() {
  const [imageSrc, setImageSrc] = useState(null);
  const [rawGrid, setRawGrid] = useState(null);
  const [grid, setGrid] = useState(null);
  const [bgTolerance, setBgTolerance] = useState(DEFAULT_BG_TOLERANCE);
  const [cuts, setCuts] = useState(null);
  const [name, setName] = useState("My Character");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [activeAvatarId, setActiveAvatarId] = useState(null);
  const [editSession, setEditSession] = useState(0);

  const staticCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const { confirm, modal: confirmModal } = useConfirm();

  const handleImageLoad = useCallback((dataUrl) => {
    setImageSrc(dataUrl);
    setRawGrid(null);
    setGrid(null);
    setCuts(null);
    setBgTolerance(DEFAULT_BG_TOLERANCE);
    setEditSession(0);
    setMsg("");
    setIsError(false);
  }, []);

  const handleUploadReject = useCallback((message) => {
    setMsg(message);
    setIsError(true);
  }, []);

  // Load existing avatars
  const loadAvatars = useCallback(async () => {
    const res = await fetch(`${API}/api/avatars`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setAvatars(data.avatars);
    setActiveAvatarId(data.activeAvatarId);
  }, []);

  useEffect(() => { loadAvatars(); }, [loadAvatars]);

  // Render static preview
  useEffect(() => {
    if (staticCanvasRef.current && grid) {
      renderStatic(staticCanvasRef.current, grid, 180);
    }
  }, [grid]);

  const handleProcess = () => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      const extracted = imageToRawGrid(img);
      setRawGrid(extracted);
      setBgTolerance(DEFAULT_BG_TOLERANCE);
      setCuts(defaultCuts(extracted.length));
    };
    img.src = imageSrc;
  };

  const adjustBgTolerance = (delta) => {
    setBgTolerance((prev) => {
      const next = prev + delta;
      return Math.min(MAX_BG_TOLERANCE, Math.max(MIN_BG_TOLERANCE, next));
    });
  };

  useEffect(() => {
    if (!rawGrid) return;
    setGrid(autoRemoveBackground(rawGrid, bgTolerance));
    setEditSession((n) => n + 1);
  }, [rawGrid, bgTolerance]);

  const handleSave = async () => {
    if (!grid || !cuts) return;
    setIsSaving(true);
    setMsg("");
    const res = await fetch(`${API}/api/avatars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        avatarGrid: grid,
        avatarCuts: cuts,
        name,
        sourceImageUrl: imageSrc ?? "",
      }),
    });
    const data = await res.json();
    setIsSaving(false);
    if (res.ok) {
      setMsg("Saved and set as active.");
      setIsError(false);
      setGrid(null);
      setRawGrid(null);
      setCuts(null);
      setBgTolerance(DEFAULT_BG_TOLERANCE);
      setImageSrc(null);
      setName("My Character");
      loadAvatars();
    } else {
      setMsg(data.error || "Save failed.");
      setIsError(true);
    }
  };

  const handleActivate = async (id) => {
    await fetch(`${API}/api/avatars/${id}/activate`, {
      method: "PATCH",
      credentials: "include",
    });
    setActiveAvatarId(id);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: "Delete this character?",
      message: "This pixel character will be removed from your collection.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${API}/api/avatars/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Delete failed.");
      setIsError(true);
      return;
    }
    loadAvatars();
  };

  return (
    <main className="main">
      <div className="main-inner">
        <div className="sec-head">
          <div className="sec-title">Avatar Studio</div>
        </div>

        <div className="as-wrap">
          {/* Left column */}
          <div className="as-left">
            <AvatarUploadZone
              imageSrc={imageSrc}
              onImageLoad={handleImageLoad}
              onReject={handleUploadReject}
            />

            <div className="as-actions">
              <button className="as-btn as-btn-primary" onClick={handleProcess} disabled={!imageSrc}>
                Process image
              </button>
            </div>

            {rawGrid && (
              <div className="as-bg-control">
                <span className="as-bg-control-label">Background removal</span>
                <div className="as-bg-control-stepper">
                  <button
                    type="button"
                    className="as-btn as-btn-ghost as-bg-step-btn"
                    onClick={() => adjustBgTolerance(-BG_TOLERANCE_STEP)}
                    disabled={bgTolerance <= MIN_BG_TOLERANCE}
                    aria-label="Reduce background removal"
                  >
                    −
                  </button>
                  <span className="as-bg-control-value">{bgTolerance}</span>
                  <button
                    type="button"
                    className="as-btn as-btn-ghost as-bg-step-btn"
                    onClick={() => adjustBgTolerance(BG_TOLERANCE_STEP)}
                    disabled={bgTolerance >= MAX_BG_TOLERANCE}
                    aria-label="Increase background removal"
                  >
                    +
                  </button>
                </div>
                <span className="as-bg-control-hint">0 = off · lower keeps more · higher removes more · resets manual edits</span>
              </div>
            )}

            {/* Preview */}
            {grid && (
              <>
                <div className="as-preview-row">
                  <div className="as-preview-box">
                    <span className="as-preview-label">Static</span>
                    <canvas ref={staticCanvasRef} />
                  </div>
                  <div className="as-preview-box">
                    <span className="as-preview-label">Animated</span>
                    <AvatarAnimPreview grid={grid} cuts={cuts} size={180} />
                  </div>
                </div>

                <PixelGridEditor key={editSession} grid={grid} onGridChange={setGrid} />

                <div className="as-name-row">
                  <input
                    className="as-name-input"
                    type="text"
                    placeholder="Character name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button className="as-btn as-btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save character"}
                  </button>
                </div>

                {msg && <div className={`as-msg${isError ? " error" : ""}`}>{msg}</div>}
              </>
            )}
          </div>

          {/* Right column: existing avatars */}
          <div className="as-right">
            <div className="as-list-title">Your characters ({avatars.length})</div>

            {avatars.length === 0 && (
              <div className="as-empty">No characters yet.<br />Upload one to get started.</div>
            )}

            {avatars.map((av) => (
              <div key={av._id} className={`as-avatar-item${activeAvatarId?.toString() === av._id ? " active" : ""}`}>
                {activeAvatarId?.toString() === av._id ? (
                  <span className="as-avatar-active-tag">active</span>
                ) : av.isDefault ? (
                  <span className="as-avatar-default-tag">default</span>
                ) : null}
                <div className="as-avatar-thumb">
                  <AvatarThumb grid={av.avatarGrid} size={80} />
                </div>
                <div className="as-avatar-name">{av.name}</div>
                <div className="as-avatar-meta">
                  {new Date(av.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="as-avatar-btns">
                  {activeAvatarId?.toString() !== av._id && (
                    <button className="as-btn as-btn-ghost" onClick={() => handleActivate(av._id)}>
                      Use
                    </button>
                  )}
                  {!av.isDefault && (
                    <button className="as-btn as-btn-danger" onClick={() => handleDelete(av._id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />
      </div>
      {confirmModal}
    </main>
  );
}
