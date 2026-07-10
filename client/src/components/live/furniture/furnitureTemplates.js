/** Furniture render spec: zSlot + slotType + layers (+ capacity). Legacy renderTemplate is fallback only. */

export const DEFAULT_FURNITURE_W = 200;

export const LAYER_OPTIONS = [
  {
    zSlot: "char-back",
    layers: 1,
    label: "Character in front",
    subtitle: "1 image · furniture behind character",
  },
  {
    zSlot: "char-front",
    layers: 1,
    label: "Character behind",
    subtitle: "1 image · furniture covers character",
  },
  {
    zSlot: "char-middle",
    layers: 2,
    label: "Sandwiched",
    subtitle: "2 images · character between layers",
  },
];

export const SEAT_OPTIONS = [
  {
    slotType: "side",
    capacity: 1,
    label: "Single seat",
    subtitle: "Left or right slot",
  },
  {
    slotType: "center",
    capacity: 2,
    label: "Dual seats",
    subtitle: "Center · two side by side",
  },
];

/** @deprecated legacy template id → spec */
const LEGACY_TEMPLATE_SPEC = {
  "side-char-back": { zSlot: "char-back", layers: 1, slotType: "side", capacity: 1 },
  "side-char-front": { zSlot: "char-front", layers: 1, slotType: "side", capacity: 1 },
  "side-sandwich": { zSlot: "char-middle", layers: 2, slotType: "side", capacity: 1 },
  "center-shared": { zSlot: "char-front", layers: 1, slotType: "center", capacity: 2 },
};

/** @deprecated legacy furniture keys without stored spec fields */
const LEGACY_KEY_SPEC = {
  bean_bag: { zSlot: "char-back", layers: 1, slotType: "side", capacity: 1 },
  sofa: { zSlot: "char-back", layers: 1, slotType: "side", capacity: 1 },
  bed: { zSlot: "char-middle", layers: 2, slotType: "side", capacity: 1 },
  desk: { zSlot: "char-front", layers: 1, slotType: "center", capacity: 2 },
};

export const SIDE_LAYOUT_FIELDS = {
  "char-back": [
    { key: "bottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { key: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { key: "furnitureW", label: "Furniture width", min: 80, max: 520, step: 1 },
    { key: "furnitureH", label: "Furniture height", min: 60, max: 400, step: 1 },
    { key: "furnitureLiftY", label: "Char lift above base", min: 0, max: 160, step: 1 },
    { key: "charOffsetX", label: "Char offset X", min: -120, max: 160, step: 1 },
    { key: "charRotation", label: "Char rotation (deg)", min: -180, max: 180, step: 1 },
    { key: "charClipRows", label: "Char clip rows", min: 0, max: 12, step: 1 },
  ],
  "char-front": [
    { key: "bottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { key: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { key: "furnitureW", label: "Furniture width", min: 80, max: 520, step: 1 },
    { key: "furnitureH", label: "Furniture height", min: 60, max: 400, step: 1 },
    { key: "charOffsetX", label: "Char offset X", min: -120, max: 160, step: 1 },
    { key: "charOffsetY", label: "Char offset Y", min: -80, max: 120, step: 1 },
    { key: "charRotation", label: "Char rotation (deg)", min: -180, max: 180, step: 1 },
  ],
  "char-middle": [
    { key: "bottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { key: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { key: "furnitureW", label: "Furniture width", min: 80, max: 520, step: 1 },
    { key: "furnitureH", label: "Furniture height", min: 60, max: 400, step: 1 },
    { key: "furnitureLiftY", label: "Char area from base", min: 0, max: 220, step: 1 },
    { key: "charOffsetX", label: "Char offset X", min: -80, max: 160, step: 1 },
    { key: "charOffsetY", label: "Char offset Y", min: -80, max: 80, step: 1 },
    { key: "charRotation", label: "Char rotation (deg)", min: -180, max: 180, step: 1 },
  ],
};

/** @deprecated use SIDE_LAYOUT_FIELDS */
export const TEMPLATE_LAYOUT_FIELDS = {
  "side-char-back": SIDE_LAYOUT_FIELDS["char-back"],
  "side-char-front": SIDE_LAYOUT_FIELDS["char-front"],
  "side-sandwich": SIDE_LAYOUT_FIELDS["char-middle"],
};

export function imageCountForSpec(spec) {
  return spec?.layers === 2 ? 2 : 1;
}

export function validateFurnitureSpec(raw = {}) {
  let spec = { ...raw };

  const hasExplicitSpec =
    spec.zSlot &&
    spec.slotType != null &&
    spec.layers != null &&
    spec.capacity != null;

  if (raw.renderTemplate) {
    if (LEGACY_TEMPLATE_SPEC[raw.renderTemplate]) {
      spec = { ...LEGACY_TEMPLATE_SPEC[raw.renderTemplate], ...spec };
    } else if (!hasExplicitSpec) {
      return { error: "Invalid renderTemplate." };
    }
  }

  const zSlot = spec.zSlot;
  const layers = Number(spec.layers);
  const slotType = spec.slotType;
  const capacity = Number(spec.capacity);

  const errors = [];
  if (!["char-back", "char-front", "char-middle"].includes(zSlot)) {
    errors.push("Invalid zSlot.");
  }
  if (!Number.isFinite(layers) || layers < 1 || layers > 2) {
    errors.push("layers must be 1 or 2.");
  }
  if (zSlot === "char-middle" && layers !== 2) {
    errors.push("char-middle requires layers: 2.");
  }
  if (zSlot !== "char-middle" && layers !== 1) {
    errors.push(`${zSlot} requires layers: 1.`);
  }
  if (!["side", "center"].includes(slotType)) {
    errors.push("Invalid slotType.");
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    errors.push("capacity must be at least 1.");
  }
  if (capacity === 1 && slotType !== "side") {
    errors.push("Single seat must use slotType side.");
  }
  if (capacity >= 2 && slotType !== "center") {
    errors.push("Multi-seat must use slotType center.");
  }
  if (capacity >= 2 && zSlot === "char-middle") {
    errors.push("Sandwiched layer is only supported for single side seats for now.");
  }
  if (capacity >= 2 && capacity !== 2) {
    errors.push("Only dual (capacity 2) center seats are supported for now.");
  }

  if (errors.length) return { error: errors.join(" ") };

  return {
    spec: { zSlot, layers, slotType, capacity },
    imageCount: imageCountForSpec({ layers }),
  };
}

export function deriveFurnitureSpec(furniture) {
  if (!furniture) return null;

  if (
    furniture.zSlot &&
    furniture.slotType != null &&
    furniture.layers != null &&
    furniture.capacity != null
  ) {
    const result = validateFurnitureSpec(furniture);
    if (!result.error) return result.spec;
  }

  if (furniture.renderTemplate && LEGACY_TEMPLATE_SPEC[furniture.renderTemplate]) {
    return { ...LEGACY_TEMPLATE_SPEC[furniture.renderTemplate] };
  }
  if (LEGACY_KEY_SPEC[furniture.key]) {
    return { ...LEGACY_KEY_SPEC[furniture.key] };
  }
  return null;
}

/** Side renderer branch id; null when center furniture. */
export function resolveSideRenderMode(furniture) {
  const spec = deriveFurnitureSpec(furniture);
  if (!spec || spec.slotType === "center") return null;
  if (spec.zSlot === "char-back") return "side-char-back";
  if (spec.zSlot === "char-front") return "side-char-front";
  if (spec.zSlot === "char-middle") return "side-sandwich";
  return null;
}

/** @deprecated use resolveSideRenderMode */
export function resolveRenderTemplate(furniture) {
  return resolveSideRenderMode(furniture);
}

export function layoutFieldsForSpec(spec) {
  if (!spec) return [];
  if (spec.slotType === "center") return null;
  return SIDE_LAYOUT_FIELDS[spec.zSlot] ?? [];
}

export function defaultLayoutForSpec(spec) {
  if (!spec) return {};
  if (spec.slotType === "center") {
    return {
      imgBottom: -91,
      imgWidth: DEFAULT_FURNITURE_W,
      charHalfGap: 90,
      charBottom: 47,
      charWidth: 161,
      seats: Array.from({ length: spec.capacity }, () => ({
        charWidth: 161,
        charOffsetX: 0,
        charOffsetY: 0,
        charRotation: 0,
      })),
    };
  }
  if (spec.zSlot === "char-back") {
    return {
      bottom: -20,
      sideInset: 260,
      furnitureW: DEFAULT_FURNITURE_W,
      furnitureH: DEFAULT_FURNITURE_W,
      furnitureLiftY: 20,
      charOffsetX: 0,
      charRotation: 0,
      charClipRows: 0,
      charAlign: "offset",
    };
  }
  if (spec.zSlot === "char-front") {
    return {
      bottom: 0,
      sideInset: 260,
      furnitureW: DEFAULT_FURNITURE_W,
      furnitureH: DEFAULT_FURNITURE_W,
      charOffsetX: 0,
      charOffsetY: 0,
      charRotation: 0,
    };
  }
  if (spec.zSlot === "char-middle") {
    return {
      bottom: -40,
      sideInset: 360,
      furnitureW: DEFAULT_FURNITURE_W,
      furnitureH: DEFAULT_FURNITURE_W,
      furnitureLiftY: 100,
      charOffsetX: 50,
      charOffsetY: 0,
      charRotation: -90,
      charAnchor: "top",
    };
  }
  return {};
}

/** @deprecated */
export function defaultLayoutForTemplate(templateId) {
  const spec = LEGACY_TEMPLATE_SPEC[templateId];
  return spec ? defaultLayoutForSpec(spec) : {};
}

/** Scale to target width while preserving image aspect ratio (ref px). */
export function furnitureSizeFromImage(
  naturalW,
  naturalH,
  targetW = DEFAULT_FURNITURE_W,
) {
  if (!naturalW || !naturalH) {
    return {
      furnitureW: targetW,
      furnitureH: targetW,
      imageAspectHW: 1,
    };
  }
  const imageAspectHW = naturalH / naturalW;
  return {
    furnitureW: targetW,
    furnitureH: Math.round(targetW * imageAspectHW),
    imageAspectHW,
  };
}

export function heightForFurnitureWidth(width, imageAspectHW) {
  if (!imageAspectHW) return width;
  return Math.round(width * imageAspectHW);
}

export function widthForFurnitureHeight(height, imageAspectHW) {
  if (!imageAspectHW) return height;
  return Math.round(height / imageAspectHW);
}

export function seatOptionsForLayer(zSlot) {
  if (zSlot === "char-middle") {
    return SEAT_OPTIONS.filter((o) => o.slotType === "side");
  }
  return SEAT_OPTIONS;
}

export function specSummary(spec) {
  if (!spec) return "";
  const layer = LAYER_OPTIONS.find((o) => o.zSlot === spec.zSlot)?.label ?? spec.zSlot;
  const seats =
    spec.slotType === "center"
      ? `center · ${spec.capacity} seats`
      : "single · side";
  return `${layer} · ${seats}`;
}
