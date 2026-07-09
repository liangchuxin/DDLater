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
  const avatars = await Avatar.find({ user: req.session.userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });
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

// PATCH /api/avatars/:id/activate — switch active avatar (before /:id)
router.patch("/:id/activate", requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid avatar id." });
    }

    const avatar = await Avatar.findOne({ _id: req.params.id, user: req.session.userId });
    if (!avatar) return res.status(404).json({ error: "Avatar not found." });

    await Profile.findOneAndUpdate(
      { user: req.session.userId },
      { $set: { activeAvatar: avatar._id } }
    );
    return res.json({ activeAvatarId: avatar._id });
  } catch (err) {
    console.error("PATCH /api/avatars/:id/activate", err);
    return res.status(500).json({ error: "Activate failed." });
  }
});

// PATCH /api/avatars/:id — update an existing avatar (not default)
router.patch("/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid avatar id." });
    }

    const { avatarGrid, avatarCuts, name } = req.body;
    const update = {};
    if (avatarGrid) update.avatarGrid = avatarGrid;
    if (avatarCuts) update.avatarCuts = avatarCuts;
    if (typeof name === "string" && name.trim()) update.name = name.trim();

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const avatar = await Avatar.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId, isDefault: { $ne: true } },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!avatar) {
      const existing = await Avatar.findOne({ _id: req.params.id, user: req.session.userId });
      if (!existing) return res.status(404).json({ error: "Avatar not found." });
      if (existing.isDefault) {
        return res.status(403).json({ error: "Default avatar cannot be edited." });
      }
      return res.status(404).json({ error: "Avatar not found." });
    }

    return res.json({ avatar });
  } catch (err) {
    console.error("PATCH /api/avatars/:id", err);
    return res.status(500).json({ error: "Update failed." });
  }
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
