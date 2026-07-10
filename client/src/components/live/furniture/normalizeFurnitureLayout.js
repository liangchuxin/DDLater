import { deriveFurnitureSpec } from "./furnitureTemplates";
import { normalizeDeskLayout } from "./normalizeDeskLayout";

/** Map legacy per-key layout to unified template layout. */
export function normalizeFurnitureLayout(furniture) {
  const L = furniture?.layout ?? {};
  const spec = deriveFurnitureSpec(furniture);

  if (spec && furniture?.key !== "bean_bag" && furniture?.key !== "sofa" && furniture?.key !== "bed") {
    return { ...L };
  }

  if (furniture?.key === "bean_bag") {
    return {
      bottom: L.bottom ?? L.charBottom ?? -20,
      sideInset: L.sideInset ?? 260,
      furnitureW: L.furnitureW ?? L.bagWidth ?? 260,
      furnitureH: L.furnitureH ?? L.bagHeight ?? 200,
      furnitureLiftY: L.furnitureLiftY ?? L.bagOffsetY ?? 20,
      charOffsetX: L.charOffsetX ?? 0,
      charRotation: L.charRotation ?? 0,
      charClipRows: L.charClipRows ?? 0,
      charAlign: L.charAlign ?? "offset",
    };
  }

  if (furniture?.key === "sofa") {
    return {
      bottom: L.bottom ?? L.sofaBottom ?? 0,
      sideInset: L.sideInset ?? 260,
      furnitureW: L.furnitureW ?? L.sofaWidth ?? 220,
      furnitureH: L.furnitureH ?? L.sofaHeight ?? 160,
      furnitureLiftY: L.furnitureLiftY ?? 0,
      charOffsetX: L.charOffsetX ?? 0,
      charRotation: L.charRotation ?? 0,
      charClipRows: L.charClipRows ?? 3,
      charAlign: L.charAlign ?? "center",
      charTopInFurniture: L.charTopInFurniture ?? L.charTopInSofa ?? 140,
    };
  }

  if (furniture?.key === "bed") {
    return {
      bottom: L.bottom ?? -40,
      sideInset: L.sideInset ?? 360,
      furnitureW: L.furnitureW ?? L.bedWidth ?? 320,
      furnitureH: L.furnitureH ?? L.bedHeight ?? 255,
      furnitureLiftY: L.furnitureLiftY ?? L.bedOffsetY ?? 100,
      charOffsetX: L.charOffsetX ?? 50,
      charOffsetY: L.charOffsetY ?? 0,
      charRotation: L.charRotation ?? -90,
      charAnchor: L.charAnchor ?? "top",
      charSlotW: L.charSlotW ?? L.charWidth ?? 165,
    };
  }

  return L;
}

/** Canonical layout for Furniture Lab sliders (unified keys, readable values). */
export function layoutForEditing(furniture, layoutOverride = null) {
  if (!furniture) return {};
  const layout = layoutOverride ?? furniture.layout ?? {};
  const spec = deriveFurnitureSpec(furniture);
  if (spec?.slotType === "center" || furniture.key === "desk") {
    return normalizeDeskLayout(layout, furniture.capacity ?? 2);
  }
  return normalizeFurnitureLayout({ ...furniture, layout });
}
