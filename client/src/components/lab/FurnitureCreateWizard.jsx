import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LAYER_OPTIONS,
  defaultLayoutForSpec,
  furnitureSizeFromImage,
  heightForFurnitureWidth,
  imageCountForSpec,
  layoutFieldsForSpec,
  seatOptionsForLayer,
  specSummary,
  validateFurnitureSpec,
  widthForFurnitureHeight,
} from "../live/furniture/furnitureTemplates";
import {
  clearCreateDraft,
  loadCreateDraft,
  saveCreateDraft,
} from "./furnitureLabStorage";
import { layoutFieldsForDeskAll } from "./furnitureLayoutFields";
import LayoutTunePanel from "./LayoutTunePanel";
import {
  normalizeDeskLayout,
  setLayoutValue,
} from "../live/furniture/normalizeDeskLayout";

const API = import.meta.env.VITE_API_URL;

const DEFAULT_SPEC = {
  zSlot: "char-back",
  layers: 1,
  slotType: "side",
  capacity: 1,
};

const LEGACY_TEMPLATE_SPEC = {
  "side-char-back": DEFAULT_SPEC,
  "side-char-front": { zSlot: "char-front", layers: 1, slotType: "side", capacity: 1 },
  "side-sandwich": { zSlot: "char-middle", layers: 2, slotType: "side", capacity: 1 },
  "center-shared": { zSlot: "char-front", layers: 1, slotType: "center", capacity: 2 },
};

function slugify(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function loadImageMeta(file) {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight, blobUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Invalid image."));
    };
    img.src = blobUrl;
  });
}

function specFromDraft(stored) {
  if (stored?.zSlot) {
    return {
      zSlot: stored.zSlot,
      layers: stored.layers ?? (stored.zSlot === "char-middle" ? 2 : 1),
      slotType: stored.slotType ?? "side",
      capacity: stored.capacity ?? 1,
    };
  }
  if (stored?.templateId && LEGACY_TEMPLATE_SPEC[stored.templateId]) {
    return { ...LEGACY_TEMPLATE_SPEC[stored.templateId] };
  }
  return { ...DEFAULT_SPEC };
}

export default function FurnitureCreateWizard({
  onCreated,
  onDraftChange,
  onStatus,
  previewSection,
}) {
  const hydrated = useRef(false);
  const [step, setStep] = useState(1);
  const [spec, setSpec] = useState(() => ({ ...DEFAULT_SPEC }));
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [draftLayout, setDraftLayout] = useState(() =>
    defaultLayoutForSpec(DEFAULT_SPEC),
  );
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageAspectHW, setImageAspectHW] = useState(null);
  const [previewPosition, setPreviewPosition] = useState("left");
  const [saving, setSaving] = useState(false);

  const isCenter = spec.slotType === "center";
  const imageCount = imageCountForSpec(spec);
  const availableSeats = seatOptionsForLayer(spec.zSlot);
  const fields = useMemo(
    () =>
      isCenter
        ? layoutFieldsForDeskAll()
        : (layoutFieldsForSpec(spec) ?? []),
    [isCenter, spec.zSlot, spec.layers, spec.slotType, spec.capacity],
  );

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = loadCreateDraft();
    if (!stored) return;
    const restored = specFromDraft(stored);
    setSpec(restored);
    setName(stored.name ?? "");
    setKey(stored.key ?? "");
    setDraftLayout(stored.draftLayout ?? defaultLayoutForSpec(restored));
    setImageAspectHW(stored.imageAspectHW ?? null);
    setPreviewPosition(stored.previewPosition ?? "left");
    setStep(stored.step ?? 1);
    if (stored.imageCount) {
      onStatus?.(
        "Restored layout draft — re-pick image file(s) before uploading.",
      );
    } else {
      onStatus?.("Restored local draft from this browser.");
    }
  }, [onStatus]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveCreateDraft({
      zSlot: spec.zSlot,
      layers: spec.layers,
      slotType: spec.slotType,
      capacity: spec.capacity,
      name,
      key,
      draftLayout,
      previewPosition,
      step,
      imageAspectHW,
      imageCount: imageFiles.filter((f) => f?.file || f?.dataUrl).length,
      templateImageCount: imageCount,
    });
  }, [
    spec,
    name,
    key,
    draftLayout,
    previewPosition,
    step,
    imageFiles,
    imageAspectHW,
    imageCount,
  ]);

  useEffect(() => {
    setKey(slugify(name));
  }, [name]);

  const draftFurniture = useMemo(() => {
    if (imagePreviews.length !== imageCount) return null;
    if (!imagePreviews.every(Boolean)) return null;
    return {
      key: key || "draft",
      name: name || "Draft",
      capacity: spec.capacity,
      layers: spec.layers,
      zSlot: spec.zSlot,
      slotType: spec.slotType,
      renderTemplate: null,
      imageKeys: imagePreviews.map((p) => p.blobUrl),
      layout: isCenter ? normalizeDeskLayout(draftLayout, spec.capacity) : draftLayout,
    };
  }, [imagePreviews, imageCount, key, name, spec, draftLayout, isCenter]);

  useEffect(() => {
    onDraftChange?.(draftFurniture, previewPosition);
  }, [draftFurniture, previewPosition, onDraftChange]);

  const onImageChange = useCallback(
    async (index, file) => {
      if (!file) return;
      try {
        const meta = await loadImageMeta(file);
        const dataUrl = await readFileAsDataUrl(file);
        setImageFiles((prev) => {
          const next = [...prev];
          next[index] = { file, dataUrl };
          return next;
        });
        setImagePreviews((prev) => {
          const next = [...prev];
          if (next[index]?.blobUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(next[index].blobUrl);
          }
          next[index] = meta;
          return next;
        });
        if (index === 0 || !imageAspectHW) {
          const size = furnitureSizeFromImage(meta.w, meta.h);
          setImageAspectHW(size.imageAspectHW);
          if (isCenter) {
            setDraftLayout(
              normalizeDeskLayout(
                {
                  ...defaultLayoutForSpec(spec),
                  imgWidth: size.furnitureW,
                },
                spec.capacity,
              ),
            );
          } else {
            setDraftLayout((prev) => ({
              ...prev,
              furnitureW: size.furnitureW,
              furnitureH: size.furnitureH,
            }));
          }
        }
        setStep(4);
        onStatus?.("");
      } catch (err) {
        onStatus?.(err.message || "Could not read image.");
      }
    },
    [onStatus, isCenter, spec, imageAspectHW],
  );

  const uploadToServer = useCallback(async () => {
    if (!draftFurniture) return;
    if (!name.trim()) {
      onStatus?.("Name is required.");
      return;
    }
    const slots = [];
    for (let i = 0; i < imageCount; i += 1) {
      const slot = imageFiles[i];
      if (!slot?.file && !slot?.dataUrl) {
        onStatus?.(`Pick image ${i + 1} of ${imageCount} first.`);
        return;
      }
      slots.push(slot);
    }
    setSaving(true);
    onStatus?.("Uploading to server…");
    try {
      const safeKey = key?.match(/^[a-z]/) ? key : `f_${slugify(name) || "furniture"}`;
      const layoutPayload = isCenter
        ? normalizeDeskLayout(draftLayout, spec.capacity)
        : draftLayout;
      const specCheck = validateFurnitureSpec(spec);
      if (specCheck.error) {
        throw new Error(specCheck.error);
      }
      const payload = {
        key: safeKey,
        name: name.trim(),
        zSlot: spec.zSlot,
        slotType: spec.slotType,
        layers: spec.layers,
        capacity: spec.capacity,
        layout: layoutPayload,
      };
      const hasFiles = slots.every((slot) => slot.file instanceof File);
      let res;
      if (hasFiles) {
        const form = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          form.append(k, k === "layout" ? JSON.stringify(v) : String(v));
        });
        slots.forEach((slot) => form.append("images", slot.file));
        res = await fetch(`${API}/api/furnitures`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
      } else {
        res = await fetch(`${API}/api/furnitures`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            images: slots.map((slot) => ({ data: slot.dataUrl })),
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      clearCreateDraft();
      imagePreviews.forEach((p) => {
        if (p?.blobUrl?.startsWith("blob:")) URL.revokeObjectURL(p.blobUrl);
      });
      onStatus?.("Uploaded to server.");
      onCreated?.(data);
    } catch (err) {
      onStatus?.(err.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  }, [
    draftFurniture,
    name,
    imageCount,
    imageFiles,
    key,
    spec,
    draftLayout,
    imagePreviews,
    onStatus,
    onCreated,
  ]);

  const updateLayoutField = useCallback(
    (fieldKey, value) => {
      setDraftLayout((prev) => {
        if (isCenter) {
          return setLayoutValue(normalizeDeskLayout(prev, spec.capacity), fieldKey, value);
        }
        const next = { ...prev, [fieldKey]: value };
        if (imageAspectHW) {
          if (fieldKey === "furnitureW") {
            next.furnitureH = heightForFurnitureWidth(value, imageAspectHW);
          } else if (fieldKey === "furnitureH") {
            next.furnitureW = widthForFurnitureHeight(value, imageAspectHW);
          }
        }
        return next;
      });
    },
    [imageAspectHW, isCenter, spec.capacity],
  );

  const pickLayer = (layer) => {
    const nextSpec = {
      ...spec,
      zSlot: layer.zSlot,
      layers: layer.layers,
    };
    if (layer.zSlot === "char-middle") {
      nextSpec.slotType = "side";
      nextSpec.capacity = 1;
    }
    setSpec(nextSpec);
    setDraftLayout(defaultLayoutForSpec(nextSpec));
    setImageAspectHW(null);
    setImageFiles([]);
    setImagePreviews((prev) => {
      prev.forEach((p) => {
        if (p?.blobUrl?.startsWith("blob:")) URL.revokeObjectURL(p.blobUrl);
      });
      return [];
    });
    setStep(2);
    onStatus?.("");
  };

  const pickSeats = (seat) => {
    const nextSpec = {
      ...spec,
      slotType: seat.slotType,
      capacity: seat.capacity,
    };
    setSpec(nextSpec);
    setDraftLayout(defaultLayoutForSpec(nextSpec));
    setStep(3);
    onStatus?.("");
  };

  const discardLocal = useCallback(() => {
    clearCreateDraft();
    setSpec({ ...DEFAULT_SPEC });
    setName("");
    setKey("");
    setDraftLayout(defaultLayoutForSpec(DEFAULT_SPEC));
    setImageAspectHW(null);
    setImageFiles([]);
    setImagePreviews((prev) => {
      prev.forEach((p) => {
        if (p?.blobUrl?.startsWith("blob:")) URL.revokeObjectURL(p.blobUrl);
      });
      return [];
    });
    setStep(1);
    onDraftChange?.(null, "left");
    onStatus?.("Local draft discarded.");
  }, [onDraftChange, onStatus]);

  return (
    <>
      <p className="fl-local-note">
        Images and layout stay in this browser until you upload. Refresh-safe via local
        storage.
      </p>
      <div className="fl-step-tabs">
        {[
          [1, "Layer"],
          [2, "Seats"],
          [3, "Images"],
          [4, "Tune"],
        ].map(([n, label]) => (
          <button
            key={n}
            type="button"
            className={`fl-step-tab${step >= n ? " is-active" : ""}${step === n ? " is-current" : ""}`}
            onClick={() => {
              if (n <= step) setStep(n);
            }}
            disabled={n > step}
          >
            {n} · {label}
          </button>
        ))}
      </div>

      <div className="fl-workbench">
        <div className="fl-workbench-canvas">
          {step === 1 && (
            <section className="fl-panel fl-create-step">
              <div className="fl-panel-title">Layer</div>
              <p className="fl-hint">How the character stacks against the furniture image.</p>
              <div className="fl-template-grid">
                {LAYER_OPTIONS.map((layer) => (
                  <button
                    key={layer.zSlot}
                    type="button"
                    className={`fl-template-card${spec.zSlot === layer.zSlot ? " is-selected" : ""}`}
                    onClick={() => pickLayer(layer)}
                  >
                    <strong>{layer.label}</strong>
                    <span>{layer.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="fl-panel fl-create-step">
              <div className="fl-panel-title">Seats</div>
              <p className="fl-hint">
                Single seat goes left or right; dual seats go center only.
              </p>
              <p className="fl-meta">
                Layer: {LAYER_OPTIONS.find((l) => l.zSlot === spec.zSlot)?.label}{" "}
                <button type="button" className="fl-link-btn" onClick={() => setStep(1)}>
                  Change
                </button>
              </p>
              <div className="fl-template-grid">
                {availableSeats.map((seat) => (
                  <button
                    key={`${seat.slotType}-${seat.capacity}`}
                    type="button"
                    className={`fl-template-card${
                      spec.slotType === seat.slotType && spec.capacity === seat.capacity
                        ? " is-selected"
                        : ""
                    }`}
                    onClick={() => pickSeats(seat)}
                  >
                    <strong>{seat.label}</strong>
                    <span>{seat.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step >= 3 && (
            <section className="fl-panel fl-create-step">
              <div className="fl-panel-title">Details & images</div>
              <p className="fl-meta">
                {specSummary(spec)} · {imageCount} image(s){" "}
                <button type="button" className="fl-link-btn" onClick={() => setStep(2)}>
                  Change
                </button>
              </p>
              <label className="fl-field">
                Name
                <input
                  className="fl-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Floor Cushion"
                />
              </label>
              <label className="fl-field">
                Key
                <input
                  className="fl-input"
                  value={key}
                  onChange={(e) => setKey(slugify(e.target.value))}
                  placeholder="floor_cushion"
                />
              </label>
              {imageCount === 1 ? (
                <label className="fl-upload">
                  Furniture PNG (local file)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => onImageChange(0, e.target.files?.[0])}
                  />
                </label>
              ) : (
                <>
                  <label className="fl-upload">
                    Bottom layer PNG (local)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => onImageChange(0, e.target.files?.[0])}
                    />
                  </label>
                  <label className="fl-upload">
                    Top layer PNG (local)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => onImageChange(1, e.target.files?.[0])}
                    />
                  </label>
                </>
              )}
              {!isCenter && (
                <label className="fl-field">
                  Preview slot
                  <select
                    value={previewPosition}
                    onChange={(e) => setPreviewPosition(e.target.value)}
                  >
                    <option value="left">Left (desk center, bed right)</option>
                    <option value="center">Center (beds left & right)</option>
                    <option value="right">Right (bed left, desk center)</option>
                  </select>
                </label>
              )}
            </section>
          )}

          {previewSection}
        </div>

        <section className="fl-panel fl-panel-sliders fl-workbench-sliders">
          {step < 2 ? (
            <>
              <div className="fl-panel-title">Layout</div>
              <p className="fl-hint">Pick layer and seats to unlock layout sliders.</p>
            </>
          ) : (
            <LayoutTunePanel
              title="Layout (local)"
              hint={
                imageAspectHW != null && !isCenter
                  ? "Width default 200px · height locked to image aspect ratio"
                  : step < 4
                    ? "Upload images below to preview on canvas."
                    : undefined
              }
              fields={fields}
              furniture={{
                key: key || "preview",
                zSlot: spec.zSlot,
                slotType: spec.slotType,
                layers: spec.layers,
                capacity: spec.capacity,
              }}
              draftLayout={draftLayout}
              isCenter={isCenter}
              capacity={spec.capacity}
              onFieldChange={updateLayoutField}
              extraControls={
                <>
                  {spec.zSlot === "char-back" && !isCenter && (
                    <label className="fl-field">
                      Char align
                      <select
                        value={draftLayout.charAlign ?? "offset"}
                        onChange={(e) =>
                          setDraftLayout((prev) => ({
                            ...prev,
                            charAlign: e.target.value,
                          }))
                        }
                      >
                        <option value="offset">Offset (bean bag)</option>
                        <option value="center">Center + clip (sofa)</option>
                      </select>
                    </label>
                  )}
                  {draftLayout.charAlign === "center" &&
                    spec.zSlot === "char-back" && (
                      <label className="fl-slider-label">
                        Char top in furniture{" "}
                        <span className="fl-val">
                          {draftLayout.charTopInFurniture ?? 140}
                        </span>
                        <input
                          type="range"
                          min={40}
                          max={220}
                          step={1}
                          value={draftLayout.charTopInFurniture ?? 140}
                          onChange={(e) =>
                            setDraftLayout((prev) => ({
                              ...prev,
                              charTopInFurniture: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    )}
                </>
              }
              footer={
                step >= 3 ? (
                  <div className="fl-btn-row">
                    <button type="button" className="fl-btn" onClick={discardLocal}>
                      Discard local draft
                    </button>
                    <button
                      type="button"
                      className="fl-btn fl-btn-primary"
                      onClick={uploadToServer}
                      disabled={saving || !draftFurniture}
                    >
                      {saving ? "Uploading…" : "Save & upload to server"}
                    </button>
                  </div>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
