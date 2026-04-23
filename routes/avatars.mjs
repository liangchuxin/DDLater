import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Avatar = mongoose.model("Avatar");
const Profile = mongoose.model("Profile");

const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in." });
  next();
};

// GET /api/avatars — list all avatars for the current user
router.get("/", requireLogin, async (req, res) => {
  const avatars = await Avatar.find({ user: req.session.userId }).sort({ createdAt: -1 });
  const profile = await Profile.findOne({ user: req.session.userId });
  return res.json({ avatars, activeAvatarId: profile?.activeAvatar ?? null });
});

// POST /api/avatars — create a new avatar and auto-activate it
router.post("/", requireLogin, async (req, res) => {
  const { avatarGrid, avatarCuts, name, sourceImageUrl } = req.body;
  if (!avatarGrid || !avatarCuts) return res.status(400).json({ error: "Missing avatarGrid or avatarCuts." });

  const avatar = await Avatar.create({
    user: req.session.userId,
    name: name || "My Character",
    sourceImageUrl: sourceImageUrl || "",
    avatarGrid,
    avatarCuts,
  });

  // Auto-activate the newly created avatar
  await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { $set: { activeAvatar: avatar._id } }
  );

  return res.status(201).json({ avatar });
});

// PATCH /api/avatars/:id/activate — switch active avatar
router.patch("/:id/activate", requireLogin, async (req, res) => {
  const avatar = await Avatar.findOne({ _id: req.params.id, user: req.session.userId });
  if (!avatar) return res.status(404).json({ error: "Avatar not found." });

  await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { $set: { activeAvatar: avatar._id } }
  );
  return res.json({ activeAvatarId: avatar._id });
});

// DELETE /api/avatars/:id — delete an avatar (default cannot be deleted)
router.delete("/:id", requireLogin, async (req, res) => {
  // Check if this is the default first
  const existing = await Avatar.findOne({ _id: req.params.id, user: req.session.userId });
  if (!existing) return res.status(404).json({ error: "Avatar not found." });
  if (existing.isDefault) return res.status(403).json({ error: "Default avatar cannot be deleted." });

  await Avatar.deleteOne({ _id: existing._id });

  // If the active avatar was deleted, pick another or clear.
  const profile = await Profile.findOne({ user: req.session.userId });
  if (profile?.activeAvatar?.toString() === req.params.id) {
    // Fall back to the most recent remaining avatar
    const next = await Avatar.findOne({ user: req.session.userId }).sort({ createdAt: -1 });
    await Profile.findOneAndUpdate(
      { user: req.session.userId },
      { $set: { activeAvatar: next?._id ?? null } }
    );
  }
  return res.json({ ok: true });
});

export default router;
