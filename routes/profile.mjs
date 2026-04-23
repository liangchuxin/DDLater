import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Profile = mongoose.model("Profile");
const Task = mongoose.model("Task");
const RoomEvent = mongoose.model("RoomEvent");
const StudyRoom = mongoose.model("StudyRoom");

// Compute profile stats + courses + ownedRooms, all derived from existing data:
// - taskCount: total tasks by this user in the Task collection
// - roomCount: approvals received (member_joined) + rooms owned (StudyRoom.owner)
// - daysOnDDLater: days from profile.createdAt to today (fallback 1 for legacy profiles)
// - courses: unique course codes across all of the user's tasks
// - ownedRooms: user's currently active rooms they own (_id / uid / name)
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

  // Dedup course codes
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

// GET /api/profile — current user's profile, with activeAvatar + stats + courses + ownedRooms
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

// GET /api/profile/:uid — another user's profile, with activeAvatar + stats + courses + ownedRooms
router.get('/:uid', async (req, res) => {
  const profile = await Profile.findOne({ uid: req.params.uid }).populate("activeAvatar");
  if (!profile) return res.status(404).json({ error: 'User not found.' });
  const extras = await buildExtras(profile.user, profile.createdAt);
  return res.json({ ...profile.toObject(), ...extras });
});

export default router;
