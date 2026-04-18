import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const router = express.Router();
const User = mongoose.model("User");
const Profile = mongoose.model("Profile");

const generateUID = customAlphabet("0123456789", 11);

async function uniqueUID() {
  let uid;
  let exists = true;
  while (exists) {
    uid = generateUID();
    exists = await Profile.findOne({ uid });
  }
  return uid;
}

router.post("/register", async (req, res) => {
  const { email, displayName, password } = req.body;
  const existing = await User.findOne({ email });

  if (existing) {
    return res.status(400).json({ error: "Email already registered." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = new User({ email, hash });
  await user.save();

  const uid = await uniqueUID();
  const profile = new Profile({ user: user._id, displayName, uid });
  await profile.save();
  return res.json({ message: "Registration success." });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });

  if (!existing) {
    return res.status(400).json({ error: "Email not found." });
  }
  const match = bcrypt.compareSync(password, existing.hash);
  if (!match) {
    return res.status(400).json({ error: "Incorrect password." });
  }
  req.session.userId = existing._id;
  // 读 profile 拿 displayName
  const profile = await Profile.findOne({ user: existing._id });
  return res.json({ _id: existing._id, displayName: profile?.displayName ?? '', uid: profile?.uid ?? '' });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const profile = await Profile.findOne({ user: req.session.userId });
  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }
  return res.json({ _id: req.session.userId, displayName: profile.displayName, uid: profile.uid, avatar: profile.avatar ?? null });
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  return res.json({ message: "Logged out." });
});

// PATCH /api/auth/email - 修改邮箱
router.patch("/email", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const { email } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ error: "Email already in use." });
  }
  await User.findByIdAndUpdate(req.session.userId, { email });
  return res.json({ message: "Email updated." });
});

// PATCH /api/auth/password - 修改密码
router.patch("/password", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.session.userId);
  const match = bcrypt.compareSync(oldPassword, user.hash);
  if (!match) {
    return res.status(400).json({ error: "Incorrect current password." });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await User.findByIdAndUpdate(req.session.userId, { hash });
  return res.json({ message: "Password updated." });
});

export default router;

// router.post("/login", async (req, res) => {});
