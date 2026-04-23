import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Task = mongoose.model("Task");

// GET /api/tasks - current user's tasks
router.get("/", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const tasks = await Task.find({ user: req.session.userId }).populate('course').sort({
    dueDate: 1,
  });
  return res.json(tasks);
});

// GET /api/tasks/feed - publicly visible tasks, randomized, 30 by default.
// Must be registered before /:id so the param doesn't swallow 'feed'.
router.get("/feed", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });

  const limit = Math.min(parseInt(req.query.limit) || 30, 60);

  const Profile = mongoose.model("Profile");
  const StudyRoom = mongoose.model("StudyRoom");

  // Sample matching task ids randomly
  const sampled = await Task.aggregate([
    { $match: { hideFromClassmates: { $ne: true } } },
    { $sample: { size: limit } },
    { $project: { _id: 1 } },
  ]);
  const ids = sampled.map((t) => t._id);

  const tasks = await Task.find({ _id: { $in: ids } }).populate("course");

  // Restore the sampled order
  const taskMap = new Map(tasks.map((t) => [String(t._id), t]));
  const ordered = ids.map((id) => taskMap.get(String(id))).filter(Boolean);

  // Batch-fetch all involved profiles (with activeAvatar)
  const userIds = [...new Set(ordered.map((t) => String(t.user)))];
  const profiles = await Profile.find({ user: { $in: userIds } })
    .populate("activeAvatar")
    .lean();
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  // Which of these users are currently members of any active study room
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

  const feed = ordered.map((t) => {
    const tObj = t.toObject();
    tObj.authorProfile = profileMap.get(String(t.user)) || null;
    tObj.authorInRoom = usersInRoom.has(String(t.user));
    return tObj;
  });

  return res.json(feed);
});

// POST /api/tasks - create a new task
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

  // Resolve course: use the provided school, then profile's, then 'Unspecified'.
  let courseId = null;
  if (course) {
    const Course = mongoose.model('Course');
    const Profile = mongoose.model('Profile');
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

// GET /api/tasks/:id - fetch a single task
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

// PATCH /api/tasks/:id - update a task
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

  // Capture pre-update state so we can detect the incomplete -> complete transition.
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

  // Just completed: emit + broadcast to every room containing this task.
  // Otherwise, if log=true (slider drag end), log a task_progress event.
  const shouldLog = req.query.log === 'true';
  if (!wasComplete && nowComplete) {
    await logToRooms(req, task, 'task_complete');
  } else if (shouldLog && !nowComplete) {
    await logToRooms(req, task, 'task_progress');
  }

  return res.json(task);
});

// Write an event and socket-broadcast to every active room containing this task.
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

// DELETE /api/tasks/:id - delete a task
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
