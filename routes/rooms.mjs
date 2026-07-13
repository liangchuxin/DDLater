import express from 'express';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import {
  assignOwnerSeat,
  assignSeatForJoin,
  ensureAllMemberSeats,
  reconcileMemberSeats,
  swapMemberSeats,
  syncCenterFurniture,
  healCenterFurniture,
} from '../seatUtils.mjs';
import {
  clearPendingSwap,
  createPendingSwap,
  getPendingSwap,
  SWAP_TTL_MS,
} from '../seatSwapStore.mjs';
import {
  allowedFurnitureKeysForUser,
  getUserFurnitureKeys,
  getUserFurnitureKeysByMembers,
} from '../userFurnitureUtils.mjs';
import { deriveFurnitureSpec } from '../furnitureUploadUtils.mjs';

const router = express.Router();
const StudyRoom = mongoose.model('StudyRoom');
const Furniture = mongoose.model('Furniture');
const RoomEvent = mongoose.model('RoomEvent');
const Profile = mongoose.model('Profile');
const Task = mongoose.model('Task');

async function memberFurnitureKeysMap(members) {
  const userIds = members.map((m) => m.user?._id ?? m.user);
  return getUserFurnitureKeysByMembers(userIds);
}

const generateUID = customAlphabet('0123456789', 7);

async function uniqueRoomUID() {
  let uid;
  let exists = true;
  while (exists) {
    uid = generateUID();
    exists = await StudyRoom.findOne({ uid });
  }
  return uid;
}

// Lookup a room by _id or uid. The join page only has uid (the 7-digit code).
async function findRoom(idOrUid) {
  if (mongoose.Types.ObjectId.isValid(idOrUid)) {
    const byId = await StudyRoom.findById(idOrUid);
    if (byId) return byId;
  }
  return StudyRoom.findOne({ uid: idOrUid });
}

function isAdmin(room, userId) {
  return String(room.owner) === String(userId);
}

// Record an event. Returns an actor-populated version ready for broadcast.
async function emitEvent(roomDoc, type, actorId, payload = {}) {
  const ev = await RoomEvent.create({
    room: roomDoc._id,
    type,
    actor: actorId,
    payload,
  });
  return populateEvent(ev);
}

// Broadcast to all sockets subscribed to this room.
// Admin-only events are sent to everyone and filtered on the client (we don't
// track per-socket admin state). Safe because GET /events already filters, and
// the broadcast payload contains nothing sensitive.
function broadcast(req, roomDoc, event) {
  const io = req.app?.get('io');
  if (!io) return;
  io.to(`room:${roomDoc.uid}`).emit('room-event', event);
}

function notifyUser(req, userId, event) {
  const io = req.app?.get('io');
  if (!io) return;
  io.to(`user:${userId}`).emit('room-event', event);
}

async function buildEphemeralEvent(type, actorId, payload = {}) {
  const profile = await Profile.findOne(
    { user: actorId },
    'user displayName avatar uid',
  );
  return {
    type,
    payload,
    ephemeral: true,
    createdAt: new Date(),
    actor: profile
      ? {
          _id: actorId,
          uid: profile.uid,
          displayName: profile.displayName,
          avatar: profile.avatar,
        }
      : { _id: actorId },
  };
}

function emitSwapExpired(app, { fromUserId, toUserId }) {
  const io = app?.get('io');
  if (!io) return;
  const base = { ephemeral: true, createdAt: new Date() };
  io.to(`user:${fromUserId}`).emit('room-event', {
    ...base,
    type: 'seat_swap_expired',
    payload: { requesterUserId: fromUserId },
    actor: { _id: fromUserId },
  });
  io.to(`user:${toUserId}`).emit('room-event', {
    ...base,
    type: 'seat_swap_expired',
    payload: { inviteeUserId: toUserId },
    actor: { _id: fromUserId },
  });
}

// Attach actor profile (displayName / avatar / uid) to an event for rendering.
async function populateEvent(ev) {
  const profile = await Profile.findOne(
    { user: ev.actor },
    'user displayName avatar uid',
  );
  return {
    _id: ev._id,
    type: ev.type,
    payload: ev.payload,
    resolvedAt: ev.resolvedAt,
    createdAt: ev.createdAt,
    actor: profile
      ? {
          _id: ev.actor,
          uid: profile.uid,
          displayName: profile.displayName,
          avatar: profile.avatar,
        }
      : { _id: ev.actor },
  };
}

const ADMIN_ONLY_EVENT_TYPES = new Set([
  'join_request',
  'join_approved',
  'join_rejected',
]);

/** Never shown in room history (may still be broadcast ephemerally). */
const HISTORY_EXCLUDED_EVENT_TYPES = ['seat_change'];

// GET /api/rooms - list all active rooms
router.get('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });

  const rooms = await StudyRoom.find({ active: true })
    .populate('owner', 'email')
    .populate('members.user', 'email')
    .populate({
      path: 'members.tasks',
      populate: { path: 'course' },
    });

  const furnitureKeysByUser = await memberFurnitureKeysMap(
    rooms.flatMap((room) => room.members),
  );
  for (const room of rooms) {
    if (reconcileMemberSeats(room, furnitureKeysByUser)) {
      room.markModified('members');
      await room.save();
    }
  }

  const allUserIds = [...new Set(rooms.flatMap((r) => r.members.map((m) => m.user._id.toString())))];
  const profiles = await Profile.find(
    { user: { $in: allUserIds } },
    'user displayName avatar uid activeAvatar',
  ).populate('activeAvatar');
  const profileMap = {};
  profiles.forEach((p) => { profileMap[p.user.toString()] = p; });

  const result = rooms.map((room) => ({
    ...room.toObject(),
    members: room.members.map((m) => ({
      ...m.toObject(),
      profile: profileMap[m.user._id.toString()] ?? null,
    })),
  }));

  return res.json(result);
});

// POST /api/rooms - create a room (creator becomes owner + first member)
router.post('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { name, background, furnitures } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name is required.' });
  const uid = await uniqueRoomUID();
  const room = await StudyRoom.create({
    uid,
    name,
    owner: req.session.userId,
    members: [{ user: req.session.userId, tasks: [], seat: assignOwnerSeat() }],
    pendingMembers: [],
    ...(background ? { background } : {}),
    ...(furnitures ? { furnitures } : {}),
  });
  return res.json(room);
});

// PATCH /api/rooms/:id - owner edits room
router.patch('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!isAdmin(room, req.session.userId))
    return res.status(403).json({ error: 'Not the owner.' });

  const { name, background, furnitures } = req.body;
  if (name != null) room.name = name;
  if (background != null) {
    if (background.key != null) room.background.key = background.key;
    if (background.heightPct != null) room.background.heightPct = background.heightPct;
    if (background.offsetX != null) room.background.offsetX = background.offsetX;
    if (background.offsetY != null) room.background.offsetY = background.offsetY;
  }
  if (furnitures != null) room.furnitures = furnitures;
  await room.save();
  return res.json(room);
});

// GET /api/rooms/:id - fetch a single room.
// If caller is a member: full data. Otherwise: minimal gate info only.
router.get('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });

  const room = await StudyRoom.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { uid: req.params.id },
  )
    .populate('owner', 'email')
    .populate('members.user', 'email')
    .populate({
      path: 'members.tasks',
      populate: { path: 'course' },
    })
    .populate('pendingMembers', 'email');
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const callerIsMember = room.members.some((m) => m.user._id.equals(req.session.userId));
  const callerIsPending = room.pendingMembers.some((u) => u._id.equals(req.session.userId));

  if (!callerIsMember) {
    return res.json({
      _id: room._id,
      uid: room.uid,
      name: room.name,
      active: room.active,
      isMember: false,
      isPending: callerIsPending,
      // Room seats max 4 (desk 2 + side 2). When full, frontend enters 'full' state.
      isFull: room.members.length >= 4,
    });
  }

  const furnitureKeysByUser = await memberFurnitureKeysMap(room.members);
  if (reconcileMemberSeats(room, furnitureKeysByUser)) {
    room.markModified('members');
    await room.save();
  }
  if (healCenterFurniture(room)) {
    room.markModified('members');
    await room.save();
  }

  const userIds = room.members.map((m) => m.user._id);
  const profiles = await Profile.find(
    { user: { $in: userIds } },
    'user displayName avatar uid activeAvatar',
  ).populate('activeAvatar');
  const profileMap = {};
  profiles.forEach((p) => { profileMap[p.user.toString()] = p; });

  const membersWithProfile = room.members.map((m) => ({
    ...m.toObject(),
    profile: profileMap[m.user._id.toString()] ?? null,
  }));

  return res.json({
    ...room.toObject(),
    members: membersWithProfile,
    isMember: true,
    isPending: false,
  });
});

// GET /api/rooms/:id/events?limit=50&before=<date>
// Admin sees all events; regular members don't see admin-only types.
router.get('/:id/events', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const isMember = room.members.some((m) => m.user.equals(req.session.userId));
  const admin = isAdmin(room, req.session.userId);
  if (!isMember && !admin)
    return res.status(403).json({ error: 'Not a member of this room.' });

  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
  const before = req.query.before ? new Date(req.query.before) : null;

  const q = { room: room._id };
  if (before) q.createdAt = { $lt: before };
  const excluded = [...HISTORY_EXCLUDED_EVENT_TYPES];
  if (!admin) excluded.push(...ADMIN_ONLY_EVENT_TYPES);
  q.type = { $nin: excluded };

  const events = await RoomEvent.find(q).sort({ createdAt: -1 }).limit(limit);
  const populated = await Promise.all(events.map(populateEvent));
  return res.json(populated);
});

// POST /api/rooms/:id/join - request to join (adds to pendingMembers, emits join_request)
router.post('/:id/join', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const alreadyMember = room.members.some((m) => m.user.equals(req.session.userId));
  const alreadyPending = room.pendingMembers.some((id) => id.equals(req.session.userId));
  if (alreadyMember) return res.status(400).json({ error: 'Already in this room.' });
  if (alreadyPending) return res.status(400).json({ error: 'Already requested.' });
  // Max 4 members; pending doesn't count.
  if (room.members.length >= 4)
    return res.status(400).json({ error: 'This room is full (max 4 members).' });

  room.pendingMembers.push(req.session.userId);
  await room.save();
  const ev = await emitEvent(room, 'join_request', req.session.userId);
  broadcast(req, room, ev);

  return res.json({ message: 'Join request sent.', roomUid: room.uid });
});

// POST /api/rooms/:id/approve/:userId - any admin can approve
router.post('/:id/approve/:userId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!isAdmin(room, req.session.userId))
    return res.status(403).json({ error: 'Not an admin.' });

  const pendingIdx = room.pendingMembers.findIndex((id) => id.equals(req.params.userId));
  if (pendingIdx === -1)
    return res.status(404).json({ error: 'User not in pending list.' });

  room.pendingMembers.splice(pendingIdx, 1);
  const userKeys = await getUserFurnitureKeys(req.params.userId);
  const allowed = room.furnitures?.length > 0
    ? userKeys.filter((key) => room.furnitures.includes(key))
    : userKeys;
  const seat = assignSeatForJoin(room.members, allowed);
  room.members.push({
    user: req.params.userId,
    tasks: [],
    seat: seat ?? { placement: 'side-right', furnitureKey: allowed[0] ?? 'desk' },
  });
  await room.save();

  // Mark the related join_request as resolved so the Approve button hides.
  await RoomEvent.updateMany(
    { room: room._id, type: 'join_request', actor: req.params.userId, resolvedAt: null },
    { $set: { resolvedAt: new Date() } },
  );
  // Admin-only event: join_approved (actor = admin, payload = approved user).
  const evApproved = await emitEvent(room, 'join_approved', req.session.userId, {
    targetUserId: req.params.userId,
  });
  broadcast(req, room, evApproved);
  // Visible to all: member_joined (actor = the new member).
  const evJoined = await emitEvent(room, 'member_joined', req.params.userId);
  broadcast(req, room, evJoined);

  return res.json({ message: 'User approved.' });
});

// POST /api/rooms/:id/reject/:userId - any admin can reject
router.post('/:id/reject/:userId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!isAdmin(room, req.session.userId))
    return res.status(403).json({ error: 'Not an admin.' });

  const wasPending = room.pendingMembers.some((id) => id.equals(req.params.userId));
  room.pendingMembers = room.pendingMembers.filter((id) => !id.equals(req.params.userId));
  await room.save();

  if (wasPending) {
    await RoomEvent.updateMany(
      { room: room._id, type: 'join_request', actor: req.params.userId, resolvedAt: null },
      { $set: { resolvedAt: new Date() } },
    );
    const ev = await emitEvent(room, 'join_rejected', req.session.userId, {
      targetUserId: req.params.userId,
    });
    broadcast(req, room, ev);

    // Personal channel notification so the waiting user switches to 'rejected'.
    // The room's join_rejected is admin-only; the rejected user is filtered out,
    // so we send a per-user event instead.
    const io = req.app?.get('io');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('join-rejected', {
        roomUid: room.uid,
        roomName: room.name,
      });
    }
  }
  return res.json({ message: 'User rejected.' });
});

// POST /api/rooms/:id/member/tasks - self adds a task to the room
router.post('/:id/member/tasks', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId is required.' });

  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const member = room.members.find((m) => m.user.equals(req.session.userId));
  if (!member) return res.status(403).json({ error: 'Not a member of this room.' });
  if (member.tasks.some((id) => id.equals(taskId)))
    return res.status(400).json({ error: 'Task already in room.' });

  member.tasks.push(taskId);
  await room.save();

  // Cache the task title in the event payload so history rendering doesn't re-populate.
  const task = await Task.findById(taskId, 'title');
  const ev = await emitEvent(room, 'task_add', req.session.userId, {
    taskId,
    taskTitle: task?.title ?? '',
  });
  broadcast(req, room, ev);

  return res.json({ message: 'Task added to room.' });
});

// PATCH /api/rooms/:id/member/seat - change own furniture (placement stays fixed)
router.patch('/:id/member/seat', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { furnitureKey } = req.body;
  if (!furnitureKey) return res.status(400).json({ error: 'furnitureKey is required.' });

  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const member = room.members.find((m) => m.user.equals(req.session.userId));
  if (!member) return res.status(403).json({ error: 'Not a member of this room.' });

  const allowed = await allowedFurnitureKeysForUser(req.session.userId, room);
  if (!allowed.includes(furnitureKey)) {
    return res.status(400).json({ error: 'Furniture not owned or not allowed in this room.' });
  }

  const furniture = await Furniture.findOne({ key: furnitureKey }).lean();
  if (!furniture) {
    return res.status(400).json({ error: 'Unknown furniture.' });
  }
  const spec = deriveFurnitureSpec(furniture);
  if (!spec) {
    return res.status(400).json({ error: 'Invalid furniture spec.' });
  }

  if (!member.seat?.placement) {
    const isOwner = String(member.user) === String(room.owner);
    member.seat = isOwner ? assignOwnerSeat() : assignSeatForJoin(room.members, allowed);
  }

  const isCenterSeat = member.seat.placement.startsWith('desk-');
  const isCenterFurniture = spec.slotType === 'center';
  if (isCenterSeat && !isCenterFurniture) {
    return res.status(400).json({ error: 'Center seats require dual-seat furniture.' });
  }
  if (!isCenterSeat && isCenterFurniture) {
    return res.status(400).json({ error: 'Dual-seat furniture only fits center seats.' });
  }

  if (isCenterFurniture) {
    syncCenterFurniture(room, furnitureKey);
  } else {
    member.seat.furnitureKey = furnitureKey;
  }
  await room.save();

  const ev = await buildEphemeralEvent('seat_change', req.session.userId, {
    furnitureKey,
    placement: member.seat.placement,
    centerSync: isCenterFurniture,
  });
  broadcast(req, room, ev);

  return res.json({
    message: 'Seat updated.',
    seat: member.seat,
    furnitureKey,
    centerSync: isCenterFurniture,
  });
});

// POST /api/rooms/:id/seat/swap/request — invite another member to swap seats (ephemeral, not history)
router.post('/:id/seat/swap/request', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required.' });
  if (String(targetUserId) === String(req.session.userId)) {
    return res.status(400).json({ error: 'Cannot swap with yourself.' });
  }

  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const fromMember = room.members.find((m) => m.user.equals(req.session.userId));
  const toMember = room.members.find((m) => m.user.equals(targetUserId));
  if (!fromMember || !toMember) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const furnitureKeysByUser = await memberFurnitureKeysMap(room.members);
  if (reconcileMemberSeats(room, furnitureKeysByUser)) {
    room.markModified('members');
    await room.save();
  }
  if (!fromMember.seat?.placement || !toMember.seat?.placement) {
    return res.status(400).json({ error: 'Seat not assigned yet.' });
  }

  if (getPendingSwap(room._id, req.session.userId)) {
    return res.status(409).json({ error: 'You already have a pending swap request.' });
  }

  const pending = createPendingSwap({
    roomId: room._id,
    roomUid: room.uid,
    fromUserId: req.session.userId,
    toUserId: targetUserId,
    onExpire: (entry) => emitSwapExpired(req.app, entry),
  });

  const ev = await buildEphemeralEvent('seat_swap_request', req.session.userId, {
    targetUserId: String(targetUserId),
    expiresAt: pending.expiresAt,
    ttlMs: SWAP_TTL_MS,
  });
  notifyUser(req, targetUserId, ev);

  return res.json({
    message: 'Swap request sent.',
    expiresAt: pending.expiresAt,
  });
});

// POST /api/rooms/:id/seat/swap/accept — invitee accepts; swaps placements in DB
router.post('/:id/seat/swap/accept', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { fromUserId } = req.body;
  if (!fromUserId) return res.status(400).json({ error: 'fromUserId is required.' });

  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const pending = getPendingSwap(room._id, fromUserId);
  if (!pending || String(pending.toUserId) !== String(req.session.userId)) {
    return res.status(404).json({ error: 'No pending swap request.' });
  }

  const fromMember = room.members.find((m) => m.user.equals(fromUserId));
  const toMember = room.members.find((m) => m.user.equals(req.session.userId));
  if (!fromMember || !toMember) {
    clearPendingSwap(room._id, fromUserId);
    return res.status(404).json({ error: 'Member not found.' });
  }

  const furnitureKeysByUser = await memberFurnitureKeysMap(room.members);
  reconcileMemberSeats(room, furnitureKeysByUser);
  if (!swapMemberSeats(fromMember, toMember)) {
    return res.status(400).json({ error: 'Could not swap seats.' });
  }

  reconcileMemberSeats(room, furnitureKeysByUser);
  room.markModified('members');
  await room.save();
  clearPendingSwap(room._id, fromUserId);

  const ev = await buildEphemeralEvent('seat_swap_accepted', req.session.userId, {
    fromUserId: String(fromUserId),
    toUserId: String(req.session.userId),
  });
  broadcast(req, room, ev);

  return res.json({ message: 'Seats swapped.' });
});

// POST /api/rooms/:id/seat/swap/decline — invitee declines (ephemeral, not history)
router.post('/:id/seat/swap/decline', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { fromUserId } = req.body;
  if (!fromUserId) return res.status(400).json({ error: 'fromUserId is required.' });

  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const pending = getPendingSwap(room._id, fromUserId);
  if (!pending || String(pending.toUserId) !== String(req.session.userId)) {
    return res.status(404).json({ error: 'No pending swap request.' });
  }

  clearPendingSwap(room._id, fromUserId);

  const ev = await buildEphemeralEvent('seat_swap_declined', req.session.userId, {
    requesterUserId: String(fromUserId),
  });
  notifyUser(req, fromUserId, ev);

  return res.json({ message: 'Swap request declined.' });
});

// DELETE /api/rooms/:id/member/tasks/:taskId - self removes a task from the room
router.delete('/:id/member/tasks/:taskId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const member = room.members.find((m) => m.user.equals(req.session.userId));
  if (!member) return res.status(403).json({ error: 'Not a member of this room.' });

  const had = member.tasks.some((id) => id.equals(req.params.taskId));
  member.tasks = member.tasks.filter((id) => !id.equals(req.params.taskId));
  await room.save();

  if (had) {
    const task = await Task.findById(req.params.taskId, 'title');
    const ev = await emitEvent(room, 'task_remove', req.session.userId, {
      taskId: req.params.taskId,
      taskTitle: task?.title ?? '',
    });
    broadcast(req, room, ev);
  }
  return res.json({ message: 'Task removed from room.' });
});

// DELETE /api/rooms/:id/kick/:userId - owner kicks a member.
// Kicked user receives 'kicked-from-room' on their personal channel and navigates out.
// member_kicked is visible to all (not admin-only) so remaining members see the history.
router.delete('/:id/kick/:userId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!isAdmin(room, req.session.userId))
    return res.status(403).json({ error: 'Not the owner.' });

  const targetId = req.params.userId;

  if (String(targetId) === String(req.session.userId))
    return res.status(400).json({ error: 'Cannot remove yourself. Use leave instead.' });

  const wasMember = room.members.some((m) => m.user.equals(targetId));
  if (!wasMember) return res.status(404).json({ error: 'User is not a member.' });

  room.members = room.members.filter((m) => !m.user.equals(targetId));
  await room.save();

  // Include displayName in the payload so history can render "X removed Y".
  const targetProfile = await Profile.findOne({ user: targetId }, 'displayName');
  const ev = await emitEvent(room, 'member_kicked', req.session.userId, {
    targetUserId: String(targetId),
    targetDisplayName: targetProfile?.displayName || '',
  });
  broadcast(req, room, ev);

  // Personal notification so the kicked user's Live page navigates away.
  const io = req.app?.get('io');
  if (io) {
    io.to(`user:${targetId}`).emit('kicked-from-room', {
      roomUid: room.uid,
      roomName: room.name,
    });
  }

  return res.json({ message: 'User removed.' });
});

// DELETE /api/rooms/:id/leave - leave a room.
// If the owner leaves, ownership transfers to the first remaining member.
// If the last member leaves, the room becomes inactive.
router.delete('/:id/leave', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const wasMember = room.members.some((m) => m.user.equals(req.session.userId));
  if (!wasMember) return res.status(400).json({ error: 'Not a member.' });

  const leavingIsOwner = room.owner.equals(req.session.userId);
  room.members = room.members.filter((m) => !m.user.equals(req.session.userId));

  if (leavingIsOwner && room.members.length > 0) {
    room.owner = room.members[0].user;
  }

  if (room.members.length === 0) {
    room.active = false;
    room.sessionStartAt = null;
  }

  await room.save();

  const ev = await emitEvent(room, 'leave', req.session.userId);
  broadcast(req, room, ev);
  return res.json({ message: 'Left the room.' });
});

// DELETE /api/rooms/:id - close a room (owner only).
router.delete('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!room.owner.equals(req.session.userId))
    return res.status(403).json({ error: 'Not the owner.' });

  room.active = false;
  await room.save();
  return res.json({ message: 'Room closed.' });
});

export default router;
