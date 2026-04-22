import { useState, useRef, useEffect, useCallback } from "react";
import {
  imageToGrid,
  autoRemoveBackground,
  renderStatic,
  startAnimation,
  defaultCuts,
  DEFAULT_ANIM_CONFIG,
} from "../utils/pixelChar";
import { useConfirm } from "./ConfirmModal";
import "../styles/AvatarStudio.css";

const API = import.meta.env.VITE_API_URL;

// 小型 canvas 预览组件，用于列表里的缩略图
function AvatarThumb({ grid, size = 80 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && grid) renderStatic(ref.current, grid, size);
  }, [grid, size]);
  return <canvas ref={ref} />;
}

// 带动画的预览
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
  const [grid, setGrid] = useState(null);
  const [cuts, setCuts] = useState(null);
  const [name, setName] = useState("My Character");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [activeAvatarId, setActiveAvatarId] = useState(null);

  const fileInputRef = useRef(null);
  const staticCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const { confirm, modal: confirmModal } = useConfirm();

  // 加载已有小人列表
  const loadAvatars = useCallback(async () => {
    const res = await fetch(`${API}/api/avatars`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setAvatars(data.avatars);
    setActiveAvatarId(data.activeAvatarId);
  }, []);

  useEffect(() => { loadAvatars(); }, [loadAvatars]);

  // 渲染静态预览
  useEffect(() => {
    if (staticCanvasRef.current && grid) {
      renderStatic(staticCanvasRef.current, grid, 180);
    }
  }, [grid]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageSrc(ev.target.result);
      setGrid(null);
      setCuts(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProcess = () => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      const newGrid = imageToGrid(img);
      const newCuts = defaultCuts(newGrid.length);
      setGrid(newGrid);
      setCuts(newCuts);
    };
    img.src = imageSrc;
  };

  const handleRemoveBg = () => {
    if (!grid) return;
    const newGrid = autoRemoveBackground(grid, 40);
    setGrid(newGrid);
  };

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
      setCuts(null);
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
          {/* ── 左栏 ── */}
          <div className="as-left">
            {/* 上传区 */}
            <div className="as-upload-zone" onClick={() => fileInputRef.current?.click()}>
              {imageSrc
                ? <img src={imageSrc} alt="source" />
                : <span className="as-upload-hint">Click to upload your pixel character image<br />(PNG / JPG)</span>
              }
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
            </div>

            <div className="as-actions">
              <button className="as-btn as-btn-primary" onClick={handleProcess} disabled={!imageSrc}>
                Process image
              </button>
              <button className="as-btn as-btn-ghost" onClick={handleRemoveBg} disabled={!grid}>
                Remove background again
              </button>
            </div>

            {/* 预览 */}
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

          {/* ── 右栏：已有小人 ── */}
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
