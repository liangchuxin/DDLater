/** Per-seat char params for center / multi-seat furniture (desk). Ref px @ 1435×722. */

const DEFAULT_SEAT = {
  charWidth: 161,
  charOffsetX: 0,
  charOffsetY: 0,
  charRotation: 0,
};

export function normalizeDeskLayout(layout = {}, capacity = 2) {
  const imgBottom = layout.imgBottom ?? 0;
  const imgWidth = layout.imgWidth ?? 328;
  const charHalfGap = layout.charHalfGap ?? 90;
  const charBottom = layout.charBottom ?? 47;
  const legacyCharWidth = layout.charWidth ?? DEFAULT_SEAT.charWidth;

  let seats = layout.seats;
  if (!Array.isArray(seats) || seats.length < capacity) {
    seats = Array.from({ length: capacity }, (_, i) => ({
      charWidth: seats?.[i]?.charWidth ?? legacyCharWidth,
      charOffsetX: seats?.[i]?.charOffsetX ?? 0,
      charOffsetY: seats?.[i]?.charOffsetY ?? 0,
      charRotation: seats?.[i]?.charRotation ?? 0,
    }));
  } else {
    seats = seats.slice(0, capacity).map((seat) => ({
      charWidth: seat?.charWidth ?? legacyCharWidth,
      charOffsetX: seat?.charOffsetX ?? 0,
      charOffsetY: seat?.charOffsetY ?? 0,
      charRotation: seat?.charRotation ?? 0,
    }));
  }

  return {
    imgBottom,
    imgWidth,
    charHalfGap,
    charBottom,
    charWidth: legacyCharWidth,
    seats,
  };
}

export function getDeskSeat(layout, slotIndex, capacity = 2) {
  const normalized = normalizeDeskLayout(layout, capacity);
  return normalized.seats[slotIndex] ?? normalized.seats[0];
}

export function getLayoutValue(layout, path) {
  if (!path) return undefined;
  return path.split(".").reduce((acc, key) => acc?.[key], layout);
}

export function setLayoutValue(layout, path, value) {
  const clone = JSON.parse(JSON.stringify(layout ?? {}));
  const keys = path.split(".");
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i += 1) {
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}
