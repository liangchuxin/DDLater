import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Profile = mongoose.model("Profile");
const Task = mongoose.model("Task");
const RoomEvent = mongoose.model("RoomEvent");
const StudyRoom = mongoose.model("StudyRoom");

// 计算 profile 的 stats + courses + ownedRooms,全从现有数据 derive:
// - taskCount: Task 表里用户的 task 总数
// - roomCount: 被 approve 加入 (member_joined) + 自己创建 (StudyRoom.owner)
// - daysOnDDLater: profile.createdAt 到今天的天数 (老 profile 没 createdAt 就兜底 1)
// - courses: 用户所有 task 涉及的 course code 去重列表
// - ownedRooms: 用户当前是 owner 且 active 的 room 列表 (_id / uid / name)
async function buildExtras(userId, profileCreatedAt) {
  const [taskCount, joinedCount, createdCount, userTasks, ownedRooms] = await Promise.all([
    Task.countDocuments({ user: userId }),
    RoomEvent.countDocuments({ actor: userId, type: "member_joined" }),
    StudyRoom.countDocuments({ owner: userId }),
    Task.find({ user: userId }, "course").populate("course", "courseCode"),
    StudyRoom.find(
      { owner: userId, active: true },
      "_id uid name",
    ).sort({ createdAt: -1 }),
  ]);
  const roomCount = joinedCount + createdCount;
  const rawDays = profileCreatedAt
    ? Math.floor((Date.now() - new Date(profileCreatedAt).getTime()) / 86400000)
    : 0;
  const daysOnDDLater = Math.max(1, rawDays);

  // 去重 course code
  const courses = [
    ...new Set(
      userTasks
        .map((t) => t.course?.courseCode)
        .filter(Boolean),
    ),
  ];

  return {
    taskCount,
    roomCount,
    daysOnDDLater,
    courses,
    ownedRooms,
  };
}

// GET /api/profile — 当前登录用户的 profile，带 activeAvatar + stats + courses + ownedRooms
router.get("/", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in." });
  const profile = await Profile.findOne({ user: req.session.userId }).populate("activeAvatar");
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  const extras = await buildExtras(profile.user, profile.createdAt);
  return res.json({ ...profile.toObject(), ...extras });
});

// PATCH /api/profile
router.patch('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { school, graduationYear, displayName, avatar } = req.body;
  const updates = {};
  if (school !== undefined) updates.school = school;
  if (graduationYear !== undefined) updates.graduationYear = graduationYear;
  if (displayName !== undefined) updates.displayName = displayName;
  if (avatar !== undefined) updates.avatar = avatar;
  const updated = await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { $set: updates },
    { new: true }
  ).populate("activeAvatar");
  return res.json(updated);
});

// GET /api/profile/:uid — 任意用户 profile，带 activeAvatar + stats + courses + ownedRooms
router.get('/:uid', async (req, res) => {
  const profile = await Profile.findOne({ uid: req.params.uid }).populate("activeAvatar");
  if (!profile) return res.status(404).json({ error: 'User not found.' });
  const extras = await buildExtras(profile.user, profile.createdAt);
  return res.json({ ...profile.toObject(), ...extras });
});

export default router;
