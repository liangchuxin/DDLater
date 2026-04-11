import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Profile = mongoose.model("Profile");

// GET /api/profile - 获取当前登录用户的 profile
router.get("/", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const profile = await Profile.findOne({ user: req.session.userId });
  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }
  return res.json(profile);
});

// PATCH /api/profile - 更新当前登录用户的 profile
router.patch('/', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const { school, graduationYear, avatar, displayName } = req.body;
  const updated = await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { school, graduationYear, avatar, displayName },
    { new: true }
  );
  return res.json(updated);
});

// GET /api/profile/:uid - 获取任意用户的 profile
router.get('/:uid', async (req, res) => {
  const profile = await Profile.findOne({ uid: req.params.uid });
  if (!profile) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json(profile);
});

export default router;
