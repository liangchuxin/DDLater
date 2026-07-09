const PAD = 6;
const GAP = 10;

export function defaultMenuSide(entry) {
  if (entry.position === "left") return "right";
  if (entry.position === "right") return "left";
  return "above";
}

export const MENU_SIDE_CLASS = {
  right: "is-right",
  left: "is-left",
  above: "is-above",
  below: "is-below",
};

export const MENU_VALIGN_CLASS = {
  center: "",
  start: "is-menu-v-start",
  end: "is-menu-v-end",
};

function measureMenuRect(anchorRect, menuSize, side, vAlign) {
  const { width: mw, height: mh } = menuSize;
  let left;
  let top;

  if (side === "right") {
    left = anchorRect.right + GAP;
    if (vAlign === "start") top = anchorRect.top;
    else if (vAlign === "end") top = anchorRect.bottom - mh;
    else top = anchorRect.top + anchorRect.height / 2 - mh / 2;
  } else if (side === "left") {
    left = anchorRect.left - GAP - mw;
    if (vAlign === "start") top = anchorRect.top;
    else if (vAlign === "end") top = anchorRect.bottom - mh;
    else top = anchorRect.top + anchorRect.height / 2 - mh / 2;
  } else if (side === "above") {
    top = anchorRect.top - GAP - mh;
    left = anchorRect.left + anchorRect.width / 2 - mw / 2;
  } else {
    top = anchorRect.bottom + GAP;
    left = anchorRect.left + anchorRect.width / 2 - mw / 2;
  }

  return {
    left,
    top,
    right: left + mw,
    bottom: top + mh,
  };
}

function fits(rect, bounds) {
  return (
    rect.left >= bounds.left + PAD &&
    rect.right <= bounds.right - PAD &&
    rect.top >= bounds.top + PAD &&
    rect.bottom <= bounds.bottom - PAD
  );
}

function clampNudge(rect, bounds) {
  let x = 0;
  let y = 0;
  if (rect.right > bounds.right - PAD) x = bounds.right - PAD - rect.right;
  if (rect.left + x < bounds.left + PAD) x = bounds.left + PAD - rect.left;
  if (rect.bottom > bounds.bottom - PAD) y = bounds.bottom - PAD - rect.bottom;
  if (rect.top + y < bounds.top + PAD) y = bounds.top + PAD - rect.top;
  return { x, y };
}

export function resolveSceneActionMenuPlacement(anchorRect, menuSize, canvasRect, entry) {
  const base = defaultMenuSide(entry);
  const sideOrder = [base];
  if (base === "right") sideOrder.push("left", "below", "above");
  else if (base === "left") sideOrder.push("right", "below", "above");
  else sideOrder.push("below", "right", "left");

  const valigns =
    base === "above" || base === "below"
      ? ["center"]
      : ["center", "end", "start"];

  for (const side of sideOrder) {
    const alignments =
      side === "above" || side === "below" ? ["center"] : valigns;
    for (const vAlign of alignments) {
      const rect = measureMenuRect(anchorRect, menuSize, side, vAlign);
      if (fits(rect, canvasRect)) {
        return { side, vAlign, nudge: { x: 0, y: 0 } };
      }
    }
  }

  const side = sideOrder[0];
  const vAlign =
    side === "above" || side === "below"
      ? "center"
      : "end";
  const rect = measureMenuRect(anchorRect, menuSize, side, vAlign);
  return { side, vAlign, nudge: clampNudge(rect, canvasRect) };
}
