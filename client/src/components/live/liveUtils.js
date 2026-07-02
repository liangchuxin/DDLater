// Pure utility functions; no state.

export function pctClass(pct) {
  if (pct === 100) return "done";
  if (pct < 30) return "urgent";
  if (pct < 60) return "warn";
  return "";
}

export function formatDue(d) {
  if (!d) return "no due date";
  const due = new Date(d);
  const diff = due - new Date();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return "overdue";
  if (hours < 24) return `due in ${hours}h`;
  if (days === 1) return "due tomorrow";
  if (days <= 7) return `due in ${days}d`;
  return `due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// Read the dominant color from an img element; used for badge border/shadow.
export function getDominantColor(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0, 50, 50);
  const data = ctx.getImageData(0, 0, 50, 50).data;
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    const k = `${Math.round(data[i] / 32) * 32},${Math.round(data[i + 1] / 32) * 32},${Math.round(data[i + 2] / 32) * 32}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  const [r, g, b] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0][0]
    .split(",");
  return `rgb(${r},${g},${b})`;
}

// Side slot center x, clamped by sideInset (min distance from canvas edge) and
// sideMinFromCenter (min distance from canvas center). Prevents side furniture
// from overlapping the desk on narrow screens.
export function sideCenterX(position, sideInset, canvasW, sideMinFromCenter) {
  return position === "left"
    ? Math.min(sideInset, canvasW / 2 - sideMinFromCenter)
    : Math.max(canvasW - sideInset, canvasW / 2 + sideMinFromCenter);
}

const PLACEMENT_SCENE = {
  "desk-0": { position: "center", slotIndex: 0 },
  "desk-1": { position: "center", slotIndex: 1 },
  "side-left": { position: "left", slotIndex: 0 },
  "side-right": { position: "right", slotIndex: 0 },
};

const PLACEMENT_ORDER = ["desk-0", "desk-1", "side-left", "side-right"];

function pickDeterministic(arr, seed) {
  if (!arr.length) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return arr[h % arr.length];
}

function memberUserId(member) {
  return String(member.user?._id ?? member.user);
}

/** Client fallback when server seat is missing (e.g. legacy room before migration). */
function resolveMemberSeat(member, ownerId, members, allowedKeys, resolvedByUser) {
  if (member.seat?.placement && member.seat?.furnitureKey) return member.seat;

  const userId = memberUserId(member);
  if (resolvedByUser.has(userId)) return resolvedByUser.get(userId);

  const occupied = new Set([
    ...members.map((m) => m.seat?.placement).filter(Boolean),
    ...[...resolvedByUser.values()].map((s) => s.placement),
  ]);

  let seat;
  if (userId === String(ownerId)) {
    seat = { placement: "desk-0", furnitureKey: "desk" };
  } else {
    const placement = PLACEMENT_ORDER.find((p) => !occupied.has(p));
    if (!placement) return null;

    if (placement.startsWith("desk-")) {
      seat = { placement, furnitureKey: "desk" };
    } else {
      const keys = allowedKeys.length > 0 ? allowedKeys : ["desk"];
      let pool = keys.filter((k) => k !== "desk");
      if (pool.length === 0) pool = keys;
      seat = { placement, furnitureKey: pickDeterministic(pool, userId) };
    }
  }

  resolvedByUser.set(userId, seat);
  return seat;
}

/** Build scene layout from server-persisted member seats. */
export function buildLayoutFromRoom(
  roomMembers,
  sceneMembers,
  furnitures,
  roomOwnerId,
  allowedKeys = null,
) {
  if (!roomMembers?.length || !furnitures.length) return [];

  const keys =
    allowedKeys?.length > 0 ? allowedKeys : furnitures.map((f) => f.key);
  const furnitureByKey = Object.fromEntries(
    furnitures.filter((f) => keys.includes(f.key)).map((f) => [f.key, f]),
  );
  const sceneByUserId = Object.fromEntries(
    sceneMembers.map((m) => [
      String(m.isSelf ? m._id : m.userId),
      m,
    ]),
  );

  const resolvedByUser = new Map();
  const layout = [];
  for (const m of roomMembers) {
    const userId = memberUserId(m);
    const seat = resolveMemberSeat(
      m,
      roomOwnerId,
      roomMembers,
      keys,
      resolvedByUser,
    );
    if (!seat?.placement || !seat?.furnitureKey) continue;

    const furniture = furnitureByKey[seat.furnitureKey];
    if (!furniture) continue;

    const member = sceneByUserId[userId];
    if (!member) continue;

    const scene = PLACEMENT_SCENE[seat.placement] ?? PLACEMENT_SCENE["desk-0"];
    layout.push({
      userId,
      furniture,
      slotIndex: scene.slotIndex,
      position: scene.position,
      member,
    });
  }
  return layout;
}
