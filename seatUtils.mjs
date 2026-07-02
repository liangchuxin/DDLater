// Server-side seat assignment and migration helpers.

export const PLACEMENT_ORDER = ['desk-0', 'desk-1', 'side-left', 'side-right'];

export function memberUserId(member) {
  return String(member.user?._id ?? member.user);
}

export function ownerUserId(room) {
  return String(room.owner?._id ?? room.owner);
}

export function getAllowedFurnitureKeys(room) {
  if (room.furnitures?.length > 0) return [...room.furnitures];
  return ['desk', 'bed', 'bean_bag', 'sofa'];
}

export function getOccupiedPlacements(members) {
  const set = new Set();
  for (const m of members) {
    if (m.seat?.placement) set.add(m.seat.placement);
  }
  return set;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeSeat(seat) {
  if (!seat?.placement) return seat;
  if (seat.placement.startsWith('desk-')) {
    return { placement: seat.placement, furnitureKey: 'desk' };
  }
  return {
    placement: seat.placement,
    furnitureKey: seat.furnitureKey ?? 'bean_bag',
  };
}

/** Ensure each placement is used by at most one member. */
export function reconcileMemberSeats(room) {
  const allowed = getAllowedFurnitureKeys(room);
  let changed = ensureAllMemberSeats(room);

  const seen = new Set();
  for (const m of room.members) {
    const placement = m.seat?.placement;
    if (!placement) continue;

    if (!seen.has(placement)) {
      seen.add(placement);
      continue;
    }

    const occupied = getOccupiedPlacements(room.members);
    const next = PLACEMENT_ORDER.find((p) => !occupied.has(p));
    if (!next) continue;

    occupied.add(next);
    if (next.startsWith('desk-')) {
      m.seat = { placement: next, furnitureKey: 'desk' };
    } else {
      let pool = allowed.filter((k) => k !== 'desk');
      if (pool.length === 0) pool = allowed;
      m.seat = {
        placement: next,
        furnitureKey: m.seat?.furnitureKey ?? pickRandom(pool),
      };
    }
    changed = true;
  }

  return changed;
}

export function assignOwnerSeat() {
  return { placement: 'desk-0', furnitureKey: 'desk' };
}

/** Pick the next free placement and a random allowed furniture key. */
export function assignSeatForJoin(members, allowedKeys) {
  const occupied = getOccupiedPlacements(members);
  const placement = PLACEMENT_ORDER.find((p) => !occupied.has(p));
  if (!placement) return null;

  const keys = allowedKeys.length > 0 ? allowedKeys : ['desk'];
  const isDeskPlacement = placement.startsWith('desk-');
  if (isDeskPlacement) {
    return { placement, furnitureKey: 'desk' };
  }

  let pool = keys.filter((k) => k !== 'desk');
  if (pool.length === 0) pool = keys;

  return { placement, furnitureKey: pickRandom(pool) };
}

/** Backfill seats for legacy rooms; returns true if any member was updated. */
export function ensureAllMemberSeats(room) {
  const allowed = getAllowedFurnitureKeys(room);
  let changed = false;

  const ownerId = ownerUserId(room);
  const ownerMember = room.members.find(
    (m) => memberUserId(m) === ownerId,
  );
  if (
    ownerMember &&
    (!ownerMember.seat?.placement || !ownerMember.seat?.furnitureKey)
  ) {
    ownerMember.seat = assignOwnerSeat();
    changed = true;
  }

  for (const m of room.members) {
    if (memberUserId(m) === ownerId) continue;
    if (m.seat?.placement && m.seat?.furnitureKey) continue;
    m.seat = assignSeatForJoin(room.members, allowed);
    if (m.seat) changed = true;
  }

  return changed;
}

export function placementToScene(placement) {
  switch (placement) {
    case 'desk-0':
      return { position: 'center', slotIndex: 0 };
    case 'desk-1':
      return { position: 'center', slotIndex: 1 };
    case 'side-left':
      return { position: 'left', slotIndex: 0 };
    case 'side-right':
      return { position: 'right', slotIndex: 0 };
    default:
      return { position: 'center', slotIndex: 0 };
  }
}

/** Exchange placement + furniture between two members (placements stay unique). */
export function swapMemberSeats(memberA, memberB) {
  const seatA = memberA?.seat;
  const seatB = memberB?.seat;
  if (!seatA?.placement || !seatB?.placement) return false;
  if (!seatA?.furnitureKey || !seatB?.furnitureKey) return false;
  if (seatA.placement === seatB.placement) return false;

  const placementA = seatA.placement;
  const placementB = seatB.placement;
  const furnitureA = seatA.furnitureKey;
  const furnitureB = seatB.furnitureKey;

  memberA.seat = normalizeSeat({
    placement: placementB,
    furnitureKey: furnitureB,
  });
  memberB.seat = normalizeSeat({
    placement: placementA,
    furnitureKey: furnitureA,
  });
  return true;
}
