import express from 'express';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const router = express.Router();
const StudyRoom = mongoose.model('StudyRoom');
const RoomEvent = mongoose.model('RoomEvent');
const Profile = mongoose.model('Profile');
const Task = mongoose.model('Task');

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

// ── Helpers ──────────────────────────────────────────────────────────────────
// 通过 _id 或 uid 找房间。前端 join 页从 code 输入只能拿到 uid，所以都要支持。
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

// 记录一条事件。返回 populate 过 actor profile 的版本，方便调用方直接广播。
async function emitEvent(roomDoc, type, actorId, payload = {}) {
  const ev = await RoomEvent.create({
    room: roomDoc._id,
    type,
    actor: actorId,
    payload,
  });
  return populateEvent(ev);
}

// 广播事件到这个 room 的所有 socket 订阅者。
// admin-only 事件也发给所有人，前端自己过滤（因为我们不知道每个 socket 是不是 admin）。
// 这样实现简单；安全面没问题，GET /events 过滤过，这里广播的内容不包含敏感信息。
function broadcast(req, roomDoc, event) {
  const io = req.app?.get('io');
  if (!io) return;
  io.to(`room:${roomDoc.uid}`).emit('room-event', event);
}

// 给 event 挂上 actor 的 profile（displayName / avatar / uid），前端渲染用
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

// ── Rooms: list / create / read / update ────────────────────────────────────

// GET /api/rooms - 获取所有 active 房间列表
router.get('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });

  const rooms = await StudyRoom.find({ active: true })
    .populate('owner', 'email')
    .populate('members.user', 'email')
    .populate({
      path: 'members.tasks',
      populate: { path: 'course' },
    });

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

// POST /api/rooms - 创建房间（创建者自动成为 owner + 第一个 member）
router.post('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { name, background, furnitures } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name is required.' });
  const uid = await uniqueRoomUID();
  const room = await StudyRoom.create({
    uid,
    name,
    owner: req.session.userId,
    members: [{ user: req.session.userId, tasks: [] }],
    pendingMembers: [],
    ...(background ? { background } : {}),
    ...(furnitures ? { furnitures } : {}),
  });
  return res.json(room);
});

// PATCH /api/rooms/:id - owner 修改房间
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

// GET /api/rooms/:id - 获取单个房间
// 如果调用者是 member/admin/owner：返回完整数据（含 members, tasks, pendingMembers）
// 如果不是：返回精简数据 { uid, name, active, isMember: false, isPending }，不泄露成员信息
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
    // 非成员：只给最基本信息，不暴露其他成员
    return res.json({
      _id: room._id,
      uid: room.uid,
      name: room.name,
      active: room.active,
      isMember: false,
      isPending: callerIsPending,
      // 房间座位 max 4(desk 2 + side 2)。满了前端进 'full' 态,不给申请。
      isFull: room.members.length >= 4,
    });
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

// ── Events ──────────────────────────────────────────────────────────────────

// GET /api/rooms/:id/events?limit=50&before=<date>
// admin 能看全部；普通 member 过滤掉 admin-only 事件。
router.get('/:id/events', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  // 必须是 member 或 admin 才能看 events
  const isMember = room.members.some((m) => m.user.equals(req.session.userId));
  const admin = isAdmin(room, req.session.userId);
  if (!isMember && !admin)
    return res.status(403).json({ error: 'Not a member of this room.' });

  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
  const before = req.query.before ? new Date(req.query.before) : null;

  const q = { room: room._id };
  if (before) q.createdAt = { $lt: before };
  if (!admin) q.type = { $nin: [...ADMIN_ONLY_EVENT_TYPES] };

  const events = await RoomEvent.find(q).sort({ createdAt: -1 }).limit(limit);
  const populated = await Promise.all(events.map(populateEvent));
  return res.json(populated);
});

// ── Join flow ───────────────────────────────────────────────────────────────

// POST /api/rooms/:id/join - 申请加入房间（进 pendingMembers），发 join_request 事件
router.post('/:id/join', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const alreadyMember = room.members.some((m) => m.user.equals(req.session.userId));
  const alreadyPending = room.pendingMembers.some((id) => id.equals(req.session.userId));
  if (alreadyMember) return res.status(400).json({ error: 'Already in this room.' });
  if (alreadyPending) return res.status(400).json({ error: 'Already requested.' });
  // 房间座位 max 4;满了不收新申请(pending 不算,pending 被 approve 时也不会超)
  if (room.members.length >= 4)
    return res.status(400).json({ error: 'This room is full (max 4 members).' });

  room.pendingMembers.push(req.session.userId);
  await room.save();
  const ev = await emitEvent(room, 'join_request', req.session.userId);
  broadcast(req, room, ev);

  return res.json({ message: 'Join request sent.', roomUid: room.uid });
});

// POST /api/rooms/:id/approve/:userId - 任何 admin 可以 approve
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
  room.members.push({ user: req.params.userId, tasks: [] });
  await room.save();

  // 1) 把对应的 join_request 标记为已处理，前端据此隐藏 Approve 按钮
  await RoomEvent.updateMany(
    { room: room._id, type: 'join_request', actor: req.params.userId, resolvedAt: null },
    { $set: { resolvedAt: new Date() } },
  );
  // 2) admin-only 事件：join_approved（actor = admin，payload 记谁被批准）
  const evApproved = await emitEvent(room, 'join_approved', req.session.userId, {
    targetUserId: req.params.userId,
  });
  broadcast(req, room, evApproved);
  // 3) 大家可见：member_joined（actor = 新加入的人）
  const evJoined = await emitEvent(room, 'member_joined', req.params.userId);
  broadcast(req, room, evJoined);

  return res.json({ message: 'User approved.' });
});

// POST /api/rooms/:id/reject/:userId - 任何 admin 可以 reject
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

    // 额外给被 reject 的人发一个个人通知（通过 user:<id> channel）。
    // 他在 waiting 页等着，收到后要能切到 rejected 态。
    // room 的 join_rejected 是 admin-only，他订阅了也过滤不到；此处用个人 channel 单独发。
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

// ── Tasks in room ───────────────────────────────────────────────────────────

// POST /api/rooms/:id/member/tasks - 自己加 task 进房间
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

  // payload 存 task 标题方便前端渲染 history 不用再去 populate
  const task = await Task.findById(taskId, 'title');
  const ev = await emitEvent(room, 'task_add', req.session.userId, {
    taskId,
    taskTitle: task?.title ?? '',
  });
  broadcast(req, room, ev);

  return res.json({ message: 'Task added to room.' });
});

// DELETE /api/rooms/:id/member/tasks/:taskId - 自己从房间移除 task
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

// ── Leave / close ───────────────────────────────────────────────────────────

// DELETE /api/rooms/:id/kick/:userId - owner 踢人
// 被踢的人通过个人 channel 收到 'kicked-from-room' 自动离开
// member_kicked 事件全员可见(不是 admin-only)——让剩下的成员看到"X removed Y"的 history
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

  // 取被踢的人的 displayName,payload 带上给 history 渲染用
  // (不 populate 的话 history 只能显示 "removed a member" 而不是具体名字)
  const targetProfile = await Profile.findOne({ user: targetId }, 'displayName');
  const ev = await emitEvent(room, 'member_kicked', req.session.userId, {
    targetUserId: String(targetId),
    targetDisplayName: targetProfile?.displayName || '',
  });
  broadcast(req, room, ev);

  // 个人 channel 通知被踢的人,他的 Live 页会 navigate 走
  const io = req.app?.get('io');
  if (io) {
    io.to(`user:${targetId}`).emit('kicked-from-room', {
      roomUid: room.uid,
      roomName: room.name,
    });
  }

  return res.json({ message: 'User removed.' });
});

// DELETE /api/rooms/:id/leave - 离开房间
// 如果离开的是 owner，owner 转给 members 里剩下的第一个人。
// 如果是最后一个 member，room 变为 inactive。
router.delete('/:id/leave', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const wasMember = room.members.some((m) => m.user.equals(req.session.userId));
  if (!wasMember) return res.status(400).json({ error: 'Not a member.' });

  const leavingIsOwner = room.owner.equals(req.session.userId);
  room.members = room.members.filter((m) => !m.user.equals(req.session.userId));

  // Owner 离开：转给 members 里第一个人
  if (leavingIsOwner && room.members.length > 0) {
    room.owner = room.members[0].user;
  }

  // 最后一个 member 离开：room 变 inactive + 清 session
  if (room.members.length === 0) {
    room.active = false;
    room.sessionStartAt = null;
  }

  await room.save();

  const ev = await emitEvent(room, 'leave', req.session.userId);
  broadcast(req, room, ev);
  return res.json({ message: 'Left the room.' });
});

// DELETE /api/rooms/:id - 关闭房间（只有 owner 可以）
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
