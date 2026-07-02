// In-memory pending seat swap requests (TTL matches client countdown).

export const SWAP_TTL_MS = 10_000;

const pending = new Map();

function key(roomId, fromUserId) {
  return `${roomId}:${fromUserId}`;
}

export function getPendingSwap(roomId, fromUserId) {
  const entry = pending.get(key(roomId, fromUserId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    clearPendingSwap(roomId, fromUserId);
    return null;
  }
  return entry;
}

export function createPendingSwap({
  roomId,
  roomUid,
  fromUserId,
  toUserId,
  onExpire,
}) {
  clearPendingSwap(roomId, fromUserId);

  const expiresAt = Date.now() + SWAP_TTL_MS;
  const entry = {
    roomId: String(roomId),
    roomUid,
    fromUserId: String(fromUserId),
    toUserId: String(toUserId),
    expiresAt,
  };

  entry.timer = setTimeout(() => {
    if (pending.get(key(roomId, fromUserId)) !== entry) return;
    pending.delete(key(roomId, fromUserId));
    onExpire?.(entry);
  }, SWAP_TTL_MS);

  pending.set(key(roomId, fromUserId), entry);
  return entry;
}

export function clearPendingSwap(roomId, fromUserId) {
  const k = key(roomId, fromUserId);
  const entry = pending.get(k);
  if (entry?.timer) clearTimeout(entry.timer);
  pending.delete(k);
}
