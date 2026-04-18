import express from 'express';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const router = express.Router();
const StudyRoom = mongoose.model('StudyRoom');

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

// GET /api/rooms - 获取所有 active 房间列表
router.get('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const Profile = mongoose.model('Profile');

  const rooms = await StudyRoom.find({ active: true })
    .populate('owner', 'email')
    .populate('members.user', 'email')
    .populate({
      path: 'members.tasks',
      populate: { path: 'course' },
    });

  // 每个房间拼入 profile
  const allUserIds = [...new Set(rooms.flatMap(r => r.members.map(m => m.user._id.toString())))];
  const profiles = await Profile.find({ user: { $in: allUserIds } }, 'user displayName avatar uid');
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.user.toString()] = p; });

  const result = rooms.map(room => ({
    ...room.toObject(),
    members: room.members.map(m => ({
      ...m.toObject(),
      profile: profileMap[m.user._id.toString()] ?? null,
    })),
  }));

  return res.json(result);
});

// POST /api/rooms - 创建房间（创建者自动成为 owner 和第一个 member）
router.post('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name is required.' });
  const uid = await uniqueRoomUID();
  const room = await StudyRoom.create({
    uid,
    name,
    owner: req.session.userId,
    members: [{ user: req.session.userId, tasks: [] }],
    pendingMembers: [],
  });
  return res.json(room);
});

// GET /api/rooms/:id - 获取单个房间（含 members + tasks）
router.get('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const Profile = mongoose.model('Profile');

  const room = await StudyRoom.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { uid: req.params.id }
  )
    .populate('owner', 'email')
    .populate('members.user', 'email')
    .populate({
      path: 'members.tasks',
      populate: { path: 'course' },
    })
    .populate('pendingMembers', 'email');
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  // 拿所有 member 的 user id，批量查 Profile
  const userIds = room.members.map(m => m.user._id);
  const profiles = await Profile.find({ user: { $in: userIds } }, 'user displayName avatar uid');
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.user.toString()] = p; });

  // 把 profile 信息拼进每个 member
  const membersWithProfile = room.members.map(m => ({
    ...m.toObject(),
    profile: profileMap[m.user._id.toString()] ?? null,
  }));

  return res.json({ ...room.toObject(), members: membersWithProfile });
});

// POST /api/rooms/:id/join - 申请加入房间（进 pendingMembers）
router.post('/:id/join', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const alreadyMember = room.members.some(m => m.user.equals(req.session.userId));
  const alreadyPending = room.pendingMembers.some(id => id.equals(req.session.userId));
  if (alreadyMember) return res.status(400).json({ error: 'Already in this room.' });
  if (alreadyPending) return res.status(400).json({ error: 'Already requested.' });

  room.pendingMembers.push(req.session.userId);
  await room.save();
  return res.json({ message: 'Join request sent.' });
});

// POST /api/rooms/:id/approve/:userId - 房主同意某人加入
router.post('/:id/approve/:userId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!room.owner.equals(req.session.userId)) return res.status(403).json({ error: 'Not the owner.' });

  const pendingIdx = room.pendingMembers.findIndex(id => id.equals(req.params.userId));
  if (pendingIdx === -1) return res.status(404).json({ error: 'User not in pending list.' });

  room.pendingMembers.splice(pendingIdx, 1);
  room.members.push({ user: req.params.userId, tasks: [] });
  await room.save();
  return res.json({ message: 'User approved.' });
});

// POST /api/rooms/:id/reject/:userId - 房主拒绝某人加入
router.post('/:id/reject/:userId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!room.owner.equals(req.session.userId)) return res.status(403).json({ error: 'Not the owner.' });

  room.pendingMembers = room.pendingMembers.filter(id => !id.equals(req.params.userId));
  await room.save();
  return res.json({ message: 'User rejected.' });
});

// POST /api/rooms/:id/member/tasks - 把一个 task 加进自己在房间里的 task 列表
router.post('/:id/member/tasks', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId is required.' });

  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const member = room.members.find(m => m.user.equals(req.session.userId));
  if (!member) return res.status(403).json({ error: 'Not a member of this room.' });
  if (member.tasks.some(id => id.equals(taskId))) return res.status(400).json({ error: 'Task already in room.' });

  member.tasks.push(taskId);
  await room.save();
  return res.json({ message: 'Task added to room.' });
});

// DELETE /api/rooms/:id/member/tasks/:taskId - 从自己在房间里的 task 列表里移除
router.delete('/:id/member/tasks/:taskId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const member = room.members.find(m => m.user.equals(req.session.userId));
  if (!member) return res.status(403).json({ error: 'Not a member of this room.' });

  member.tasks = member.tasks.filter(id => !id.equals(req.params.taskId));
  await room.save();
  return res.json({ message: 'Task removed from room.' });
});

// DELETE /api/rooms/:id/leave - 离开房间
router.delete('/:id/leave', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (room.owner.equals(req.session.userId)) return res.status(400).json({ error: 'Owner cannot leave. Close the room instead.' });

  room.members = room.members.filter(m => !m.user.equals(req.session.userId));
  await room.save();
  return res.json({ message: 'Left the room.' });
});

// DELETE /api/rooms/:id - 关闭房间（只有 owner 可以）
router.delete('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const room = await StudyRoom.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!room.owner.equals(req.session.userId)) return res.status(403).json({ error: 'Not the owner.' });

  room.active = false;
  await room.save();
  return res.json({ message: 'Room closed.' });
});

export default router;
