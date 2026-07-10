import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../live/roomConfig";
import { imageCountForSpec } from "../live/furniture/furnitureTemplates";

const API = import.meta.env.VITE_API_URL;

const SLOT_LABELS = {
  0: "Bottom layer",
  1: "Top layer",
};

export default function FurnitureImageReupload({
  furniture,
  assetVersion = 0,
  onStatus,
  onUploaded,
}) {
  const imageCount = useMemo(
    () => imageCountForSpec(furniture ?? {}),
    [furniture],
  );
  const [pendingFiles, setPendingFiles] = useState({});
  const [previewUrls, setPreviewUrls] = useState({});
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPendingFiles({});
    setPreviewUrls({});
    setMessage("");
  }, [furniture?.key]);

  useEffect(
    () => () => {
      Object.values(previewUrls).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    },
    [previewUrls],
  );

  if (!furniture) return null;

  const hasPending = Object.values(pendingFiles).some(Boolean);

  const setFileAt = (index, file) => {
    setPreviewUrls((prevUrls) => {
      const nextUrls = { ...prevUrls };
      if (nextUrls[index]?.startsWith("blob:")) {
        URL.revokeObjectURL(nextUrls[index]);
      }
      if (file) nextUrls[index] = URL.createObjectURL(file);
      else delete nextUrls[index];
      return nextUrls;
    });
    setPendingFiles((prev) => {
      const next = { ...prev };
      if (file) next[index] = file;
      else delete next[index];
      return next;
    });
    setMessage("");
  };

  const uploadImages = async () => {
    const indices = Object.keys(pendingFiles)
      .map(Number)
      .filter((i) => pendingFiles[i])
      .sort((a, b) => a - b);
    if (!indices.length) {
      const msg = "Pick at least one image file first.";
      setMessage(msg);
      onStatus?.(msg);
      return;
    }

    const slotLabels = indices
      .map((i) => {
        const name = furniture.imageKeys?.[i] ?? `image ${i}`;
        return imageCount > 1 ? `${SLOT_LABELS[i] ?? `Layer ${i}`} → ${name}` : name;
      })
      .join("\n");
    const ok = window.confirm(
      `Overwrite on disk (cannot undo without git):\n${slotLabels}\n\nContinue?`,
    );
    if (!ok) return;

    if (!API) {
      const msg = "VITE_API_URL is not set — cannot reach the server.";
      setMessage(msg);
      onStatus?.(msg);
      return;
    }

    setUploading(true);
    setMessage("Uploading images…");
    onStatus?.("Uploading images…");
    try {
      const fd = new FormData();
      for (const i of indices) {
        fd.append(`image${i}`, pendingFiles[i]);
      }
      const res = await fetch(`${API}/api/furnitures/${furniture.key}`, {
        method: "PATCH",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? "Furniture Lab uploads are disabled (NODE_ENV=production). Run the API in dev."
              : `HTTP ${res.status}`),
        );
      }
      setPendingFiles({});
      setPreviewUrls({});
      onUploaded?.(data);
      const okMsg = "Images replaced on server.";
      setMessage(okMsg);
      onStatus?.(okMsg);
    } catch (err) {
      const errMsg = err.message || "Image upload failed.";
      setMessage(errMsg);
      onStatus?.(errMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fl-image-reupload">
      <div className="fl-panel-title">Images</div>
      <p className="fl-meta">
        Pick new PNG/JPEG/WebP to overwrite existing files (same filename on disk).
      </p>
      <div className="fl-image-reupload-grid">
        {Array.from({ length: imageCount }, (_, index) => {
          const filename = furniture.imageKeys?.[index];
          const previewSrc = previewUrls[index]
            ? previewUrls[index]
            : filename
              ? `${assetUrl(filename)}${assetVersion ? `?v=${assetVersion}` : ""}`
              : "";
          const label =
            imageCount > 1
              ? (SLOT_LABELS[index] ?? `Layer ${index + 1}`)
              : "Image";
          return (
            <div key={index} className="fl-image-reupload-slot">
              <div className="fl-image-reupload-label">{label}</div>
              <div className="fl-image-reupload-thumb-wrap">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="fl-image-reupload-thumb"
                    draggable={false}
                  />
                ) : (
                  <span className="fl-image-reupload-empty">No image</span>
                )}
              </div>
              {filename && (
                <code className="fl-image-reupload-filename">{filename}</code>
              )}
              <label className="fl-btn fl-image-reupload-pick">
                {pendingFiles[index] ? "Change file" : "Replace…"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setFileAt(index, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
      <div className="fl-btn-row">
        <button
          type="button"
          className="fl-btn fl-btn-primary"
          disabled={uploading}
          onClick={uploadImages}
        >
          {uploading ? "Uploading…" : "Upload & overwrite"}
        </button>
        {hasPending && !uploading && (
          <button
            type="button"
            className="fl-btn"
            onClick={() => {
              Object.values(previewUrls).forEach((url) => {
                if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
              });
              setPendingFiles({});
              setPreviewUrls({});
            }}
          >
            Clear picks
          </button>
        )}
      </div>
      {message && (
        <p
          className={`fl-image-reupload-msg${message.includes("failed") || message.includes("disabled") || message.includes("Nothing") || message.includes("Pick") || message.includes("HTTP") ? " is-error" : message.includes("replaced") ? " is-ok" : ""}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
