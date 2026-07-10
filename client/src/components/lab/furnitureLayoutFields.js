/** Slider metadata per furniture key. Values are ref px @ 1435×722. */

import { deriveFurnitureSpec, layoutFieldsForSpec } from "../live/furniture/furnitureTemplates";
import { getLayoutValue } from "../live/furniture/normalizeDeskLayout";

export const DESK_SHARED_FIELDS = [
  { path: "imgBottom", label: "Desk image bottom", min: -200, max: 120, step: 1 },
  { path: "imgWidth", label: "Desk image width", min: 100, max: 600, step: 1 },
  { path: "charHalfGap", label: "Char half gap", min: 0, max: 200, step: 1 },
  { path: "charBottom", label: "Char bottom (shared)", min: -80, max: 160, step: 1 },
];

export const DESK_SEAT_FIELDS = [
  { path: "charWidth", label: "Char slot width", min: 80, max: 260, step: 1 },
  { path: "charOffsetX", label: "Char offset X", min: -120, max: 160, step: 1 },
  { path: "charOffsetY", label: "Char offset Y", min: -80, max: 120, step: 1 },
  { path: "charRotation", label: "Char rotation (deg)", min: -180, max: 180, step: 1 },
];

export const FURNITURE_LAYOUT_FIELDS = {
  bed: [
    { path: "bottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { path: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { path: "bedWidth", label: "Bed width", min: 120, max: 520, step: 1 },
    { path: "bedHeight", label: "Bed height", min: 80, max: 400, step: 1 },
    { path: "bedOffsetY", label: "Bed offset Y", min: 0, max: 220, step: 1 },
    { path: "charWidth", label: "Char width", min: 80, max: 260, step: 1 },
    { path: "charOffsetX", label: "Char offset X", min: -80, max: 160, step: 1 },
    { path: "charOffsetY", label: "Char offset Y", min: -80, max: 80, step: 1 },
    { path: "charRotation", label: "Char rotation (deg)", min: -180, max: 180, step: 1 },
  ],
  bean_bag: [
    { path: "charBottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { path: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { path: "bagWidth", label: "Bag width", min: 80, max: 420, step: 1 },
    { path: "bagHeight", label: "Bag height", min: 60, max: 320, step: 1 },
    { path: "bagOffsetY", label: "Bag offset Y", min: 0, max: 120, step: 1 },
    { path: "charOffsetX", label: "Char offset X", min: -80, max: 160, step: 1 },
    { path: "charRotation", label: "Char rotation (deg)", min: -90, max: 90, step: 1 },
  ],
  sofa: [
    { path: "sofaBottom", label: "Container bottom", min: -120, max: 80, step: 1 },
    { path: "sideInset", label: "Side inset", min: 80, max: 600, step: 1 },
    { path: "sofaWidth", label: "Sofa width", min: 80, max: 420, step: 1 },
    { path: "sofaHeight", label: "Sofa height", min: 60, max: 320, step: 1 },
    { path: "charTopInSofa", label: "Char top in sofa", min: 40, max: 220, step: 1 },
    { path: "charClipRows", label: "Char clip rows", min: 0, max: 12, step: 1 },
  ],
};

export function layoutFieldsForDesk(seatIndex = 0) {
  const seatPrefix = `seats.${seatIndex}`;
  return [
    ...DESK_SHARED_FIELDS,
    ...DESK_SEAT_FIELDS.map(({ path, ...rest }) => ({
      ...rest,
      path: `${seatPrefix}.${path}`,
    })),
  ];
}

/** All desk sliders: shared + both seats at once. */
export function layoutFieldsForDeskAll() {
  const items = [{ kind: "heading", label: "Shared" }, ...DESK_SHARED_FIELDS];
  for (const seatIndex of [0, 1]) {
    items.push({
      kind: "heading",
      label: seatIndex === 0 ? "Seat 0 (left)" : "Seat 1 (right)",
    });
    items.push(
      ...DESK_SEAT_FIELDS.map(({ path, ...rest }) => ({
        ...rest,
        path: `seats.${seatIndex}.${path}`,
      })),
    );
  }
  return items;
}

export function layoutFieldsForKey(key) {
  return FURNITURE_LAYOUT_FIELDS[key] ?? [];
}

export function layoutFieldsForFurniture(furniture) {
  const spec = deriveFurnitureSpec(furniture);
  if (spec?.slotType === "center" || furniture?.key === "desk") {
    return layoutFieldsForDeskAll();
  }
  const sideFields = layoutFieldsForSpec(spec);
  if (sideFields?.length) {
    const fields = sideFields.map(({ key, ...rest }) => ({
      ...rest,
      path: key,
    }));
    if (furniture?.key === "sofa") {
      fields.push({
        path: "charTopInFurniture",
        label: "Char top in sofa",
        min: 40,
        max: 220,
        step: 1,
      });
    }
    return fields;
  }
  return layoutFieldsForKey(furniture?.key).map(({ path, key, ...rest }) => ({
    ...rest,
    path: path ?? key,
  }));
}

export function readLayoutField(layout, field) {
  return getLayoutValue(layout, field.path) ?? 0;
}
