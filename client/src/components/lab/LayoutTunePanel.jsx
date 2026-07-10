import { readLayoutField } from "./furnitureLayoutFields";
import { normalizeDeskLayout } from "../live/furniture/normalizeDeskLayout";
import { layoutForEditing } from "../live/furniture/normalizeFurnitureLayout";

function readSideField(furniture, draftLayout, field) {
  if (!furniture) {
    const key = field.path ?? field.key;
    return draftLayout?.[key] ?? 0;
  }
  const canonical = layoutForEditing(furniture, draftLayout);
  return canonical[field.path ?? field.key] ?? 0;
}

export default function LayoutTunePanel({
  title = "Layout fields",
  hint,
  fields = [],
  furniture = null,
  draftLayout,
  isCenter = false,
  capacity = 2,
  onFieldChange,
  extraControls,
  footer,
}) {
  const normalized = isCenter ? normalizeDeskLayout(draftLayout, capacity) : draftLayout;

  return (
    <>
      <div className="fl-panel-title">{title}</div>
      {hint && <p className="fl-meta">{hint}</p>}
      {extraControls}
      {fields.length === 0 ? (
        <p className="fl-hint">No slider schema for this furniture.</p>
      ) : (
        fields.map((field) =>
          field.kind === "heading" ? (
            <div key={field.label} className="fl-slider-section">
              {field.label}
            </div>
          ) : (
            <label key={field.path ?? field.key} className="fl-slider-label">
              {field.label}{" "}
              <span className="fl-val">
                {isCenter
                  ? readLayoutField(normalized, field)
                  : readSideField(furniture, draftLayout, field)}
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={
                  isCenter
                    ? readLayoutField(normalized, field)
                    : readSideField(furniture, draftLayout, field)
                }
                onChange={(e) =>
                  onFieldChange(field.path ?? field.key, Number(e.target.value))
                }
              />
            </label>
          ),
        )
      )}
      {footer}
    </>
  );
}
