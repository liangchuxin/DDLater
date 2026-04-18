import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Profile = mongoose.model("Profile");

// GET /api/profile — 当前登录用户的 profile，带 activeAvatar
router.get("/", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in." });
  const profile = await Profile.findOne({ user: req.session.userId }).populate("activeAvatar");
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  return res.json(profile);
});

// PATCH /api/profile
router.patch('/', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { school, graduationYear, displayName } = req.body;
  const updates = {};
  if (school !== undefined) updates.school = school;
  if (graduationYear !== undefined) updates.graduationYear = graduationYear;
  if (displayName !== undefined) updates.displayName = displayName;
  const updated = await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { $set: updates },
    { new: true }
  ).populate("activeAvatar");
  return res.json(updated);
});

// GET /api/profile/:uid — 任意用户 profile，带 activeAvatar
router.get('/:uid', async (req, res) => {
  const profile = await Profile.findOne({ uid: req.params.uid }).populate("activeAvatar");
  if (!profile) return res.status(404).json({ error: 'User not found.' });
  return res.json(profile);
});

export default router;
