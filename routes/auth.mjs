import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";
import { loadDefaultAvatarData } from "../scripts/default-avatar-loader.mjs";
import { seedStarterFurniture } from "../userFurnitureUtils.mjs";
import { isCatalogAdmin } from "../adminUtils.mjs";

const router = express.Router();
const User = mongoose.model("User");
const Profile = mongoose.model("Profile");
const Avatar = mongoose.model("Avatar");

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

  // Create a default avatar copy for the new user and set it as activeAvatar.
  try {
    const defaultData = loadDefaultAvatarData();
    const avatar = await Avatar.create({
      user: user._id,
      name: defaultData.name,
      sourceImageUrl: defaultData.sourceImageUrl,
      avatarGrid: defaultData.avatarGrid,
      avatarCuts: defaultData.avatarCuts,
      isDefault: true,
    });
    profile.activeAvatar = avatar._id;
    await profile.save();
  } catch (err) {
    console.warn("[register] failed to create default avatar:", err.message);
  }

  try {
    await seedStarterFurniture(user._id);
  } catch (err) {
    console.warn("[register] failed to seed starter furniture:", err.message);
  }

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
  // Pull profile for displayName
  const profile = await Profile.findOne({ user: existing._id });
  const catalogAdmin = await isCatalogAdmin(existing._id);
  return res.json({
    _id: existing._id,
    displayName: profile?.displayName ?? "",
    uid: profile?.uid ?? "",
    isCatalogAdmin: catalogAdmin,
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const profile = await Profile.findOne({ user: req.session.userId });
  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }
  const catalogAdmin = await isCatalogAdmin(req.session.userId);
  return res.json({
    _id: req.session.userId,
    displayName: profile.displayName,
    uid: profile.uid,
    avatar: profile.avatar ?? null,
    isCatalogAdmin: catalogAdmin,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  return res.json({ message: "Logged out." });
});

// PATCH /api/auth/email - change email
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

// PATCH /api/auth/password - change password
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
