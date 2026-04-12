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
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.session.userId },
    { $set: updates },
    { new: true },
  );
  if (!task) return res.status(404).json({ error: "Task not found." });
  return res.json(task);
});

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
