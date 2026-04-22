import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Task = mongoose.model("Task");

// GET /api/tasks - 获取当前用户所有 tasks
router.get("/", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const tasks = await Task.find({ user: req.session.userId }).populate('course').sort({
    dueDate: 1,
  });
  return res.json(tasks);
});

// GET /api/tasks/feed - 公开可见 tasks 的 feed，随机顺序，默认前 30 条
// 必须在 /:id 之前注册，否则 :id 会把 'feed' 捞走
router.get("/feed", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });

  const limit = Math.min(parseInt(req.query.limit) || 30, 60);

  const Profile = mongoose.model("Profile");
  const StudyRoom = mongoose.model("StudyRoom");

  // 先随机拿符合条件的 task ids
  const sampled = await Task.aggregate([
    { $match: { hideFromClassmates: { $ne: true } } },
    { $sample: { size: limit } },
    { $project: { _id: 1 } },
  ]);
  const ids = sampled.map((t) => t._id);

  // populate course
  const tasks = await Task.find({ _id: { $in: ids } }).populate("course");

  // 按原随机顺序重排
  const taskMap = new Map(tasks.map((t) => [String(t._id), t]));
  const ordered = ids.map((id) => taskMap.get(String(id))).filter(Boolean);

  // 批量拿所有涉及用户的 profile (含 activeAvatar populate)
  const userIds = [...new Set(ordered.map((t) => String(t.user)))];
  const profiles = await Profile.find({ user: { $in: userIds } })
    .populate("activeAvatar")
    .lean();
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  // 查这些用户里哪些当前在任意 active study room 的 members 里
  const roomsWithAuthors = await StudyRoom.find(
    { active: true, "members.user": { $in: userIds } },
    { "members.user": 1 },
  ).lean();
  const usersInRoom = new Set();
  for (const room of roomsWithAuthors) {
    for (const m of room.members ?? []) {
      if (m.user) usersInRoom.add(String(m.user));
    }
  }

  // 组装输出
  const feed = ordered.map((t) => {
    const tObj = t.toObject();
    tObj.authorProfile = profileMap.get(String(t.user)) || null;
    tObj.authorInRoom = usersInRoom.has(String(t.user));
    return tObj;
  });

  return res.json(feed);
});

// POST /api/tasks - 创建新 task
router.post("/", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const {
    title,
    description,
    dueDate,
    course,
    school,
    progressNumerator,
    progressDenominator,
    hideFromClassmates,
  } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required." });

  // 处理 course
  let courseId = null;
  if (course) {
    const Course = mongoose.model('Course');
    const Profile = mongoose.model('Profile');
    // 优先用传入的 school，没有就用 profile 的，再没有就用 'Unspecified'
    let resolvedSchool = school;
    if (!resolvedSchool) {
      const profile = await Profile.findOne({ user: req.session.userId });
      resolvedSchool = profile?.school || 'Unspecified';
    }
    let existing = await Course.findOne({ courseCode: course, school: resolvedSchool });
    if (!existing) {
      existing = await Course.create({ courseCode: course, school: resolvedSchool });
    }
    courseId = existing._id;
  }

  const task = new Task({
    user: req.session.userId,
    title,
    description,
    dueDate,
    course: courseId,
    progressNumerator: progressNumerator ?? 0,
    progressDenominator: progressDenominator ?? 1,
    hideFromClassmates: hideFromClassmates ?? false,
  });
  await task.save();
  return res.json(task);
});

// GET /api/tasks/:id - 获取单个 task
router.get("/:id", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const task = await Task.findOne({
    _id: req.params.id,
    user: req.session.userId,
  }).populate('course');
  if (!task) return res.status(404).json({ error: "Task not found." });
  return res.json(task);
});

// PATCH /api/tasks/:id - 更新 task
router.patch("/:id", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const {
    title,
    description,
    dueDate,
    progressNumerator,
    progressDenominator,
    hideFromClassmates,
  } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (progressNumerator !== undefined)
    updates.progressNumerator = progressNumerator;
  if (progressDenominator !== undefined)
    updates.progressDenominator = progressDenominator;
  if (hideFromClassmates !== undefined)
    updates.hideFromClassmates = hideFromClassmates;

  // 读取更新前状态，用于检测是否从未完成 -> 完成过渡
  const before = await Task.findOne({
    _id: req.params.id,
    user: req.session.userId,
  });
  if (!before) return res.status(404).json({ error: "Task not found." });
  const wasComplete =
    before.progressDenominator > 0 &&
    before.progressNumerator >= before.progressDenominator;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.session.userId },
    { $set: updates },
    { new: true },
  );

  const nowComplete =
    task.progressDenominator > 0 &&
    task.progressNumerator >= task.progressDenominator;

  // 刚刚完成（以前没完成、现在完成了），给所有包含此 task 的 room emit + broadcast
  // 或者 log=true 时（用户拖动 slider 结束），记录一条 task_progress 事件
  const shouldLog = req.query.log === 'true';
  if (!wasComplete && nowComplete) {
    await logToRooms(req, task, 'task_complete');
  } else if (shouldLog && !nowComplete) {
    await logToRooms(req, task, 'task_progress');
  }

  return res.json(task);
});

// 给所有包含此 task 的 active room 写事件并 socket 广播
async function logToRooms(req, task, type) {
  const StudyRoom = mongoose.model("StudyRoom");
  const RoomEvent = mongoose.model("RoomEvent");
  const Profile = mongoose.model("Profile");
  const rooms = await StudyRoom.find({
    active: true,
    "members.tasks": task._id,
  });
  const io = req.app?.get("io");
  const profile = await Profile.findOne(
    { user: req.session.userId },
    "user displayName avatar uid",
  );
  for (const room of rooms) {
    const ev = await RoomEvent.create({
      room: room._id,
      type,
      actor: req.session.userId,
      payload: {
        taskId: task._id,
        taskTitle: task.title,
        progressNumerator: task.progressNumerator,
        progressDenominator: task.progressDenominator,
      },
    });
    const broadcastEvent = {
      _id: ev._id,
      type: ev.type,
      payload: ev.payload,
      resolvedAt: ev.resolvedAt,
      createdAt: ev.createdAt,
      actor: profile
        ? {
            _id: req.session.userId,
            uid: profile.uid,
            displayName: profile.displayName,
            avatar: profile.avatar,
          }
        : { _id: req.session.userId },
    };
    if (io) io.to(`room:${room.uid}`).emit("room-event", broadcastEvent);
  }
}

// DELETE /api/tasks/:id - 删除 task
router.delete("/:id", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    user: req.session.userId,
  });
  if (!task) return res.status(404).json({ error: "Task not found." });
  return res.json({ message: "Task deleted." });
});

export default router;
