// Server-side seat assignment and migration helpers.

import { STARTER_FURNITURE_KEYS } from './userFurnitureUtils.mjs';

export const PLACEMENT_ORDER = ['desk-0', 'desk-1', 'side-left', 'side-right'];

export function memberUserId(member) {
  return String(member.user?._id ?? member.user);
}

export function ownerUserId(room) {
  return String(room.owner?._id ?? room.owner);
}

function allowedForMember(room, memberId, keysByUserId) {
  const userKeys = keysByUserId?.get(String(memberId));
  const keys = userKeys?.length ? userKeys : STARTER_FURNITURE_KEYS;
  if (room.furnitures?.length > 0) {
    const roomSet = new Set(room.furnitures);
    return keys.filter((key) => roomSet.has(key));
  }
  return keys;
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

/** Shared center furniture key — desk-0 occupant wins, else first center seat. */
export function centerFurnitureKeyFromMembers(members, fallback = 'desk') {
  const desk0 = (members ?? []).find((m) => m.seat?.placement === 'desk-0');
  if (desk0?.seat?.furnitureKey) return desk0.seat.furnitureKey;
  for (const m of members ?? []) {
    if (m.seat?.placement?.startsWith('desk-') && m.seat?.furnitureKey) {
      return m.seat.furnitureKey;
    }
  }
  return fallback;
}

/** Center seats share one furniture image — update every desk-* occupant. */
export function syncCenterFurniture(room, furnitureKey) {
  for (const m of room.members) {
    if (m.seat?.placement?.startsWith('desk-')) {
      m.seat.furnitureKey = furnitureKey;
    }
  }
}

/** Heal rooms where desk-0 and desk-1 stored different center furniture keys. */
export function healCenterFurniture(room) {
  const centerMembers = room.members.filter((m) =>
    m.seat?.placement?.startsWith('desk-'),
  );
  if (centerMembers.length <= 1) return false;
  const keys = new Set(centerMembers.map((m) => m.seat.furnitureKey));
  if (keys.size <= 1) return false;
  syncCenterFurniture(room, centerFurnitureKeyFromMembers(room.members));
  return true;
}

function normalizeSeat(seat) {
  if (!seat?.placement) return seat;
  const defaultKey = seat.placement.startsWith('desk-') ? 'desk' : 'bean_bag';
  return {
    placement: seat.placement,
    furnitureKey: seat.furnitureKey ?? defaultKey,
  };
}

/** Ensure each placement is used by at most one member. */
export function reconcileMemberSeats(room, keysByUserId = null) {
  let changed = ensureAllMemberSeats(room, keysByUserId);

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
      m.seat = {
        placement: next,
        furnitureKey: centerFurnitureKeyFromMembers(room.members),
      };
    } else {
      const allowed = allowedForMember(room, memberUserId(m), keysByUserId);
      let pool = allowed.filter((k) => k !== 'desk');
      if (pool.length === 0) pool = allowed.length ? allowed : ['bean_bag'];
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
    return {
      placement,
      furnitureKey: centerFurnitureKeyFromMembers(members),
    };
  }

  let pool = keys.filter((k) => k !== 'desk');
  if (pool.length === 0) pool = keys;

  return { placement, furnitureKey: pickRandom(pool) };
}

/** Backfill seats for legacy rooms; returns true if any member was updated. */
export function ensureAllMemberSeats(room, keysByUserId = null) {
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
    const allowed = allowedForMember(room, memberUserId(m), keysByUserId);
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

  const aIsCenter = placementA.startsWith('desk-');
  const bIsCenter = placementB.startsWith('desk-');

  if (aIsCenter && bIsCenter) {
    const sharedKey = furnitureA;
    memberA.seat = { placement: placementB, furnitureKey: sharedKey };
    memberB.seat = { placement: placementA, furnitureKey: sharedKey };
    return true;
  }

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
