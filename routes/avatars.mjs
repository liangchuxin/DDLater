import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const Avatar = mongoose.model("Avatar");
const Profile = mongoose.model("Profile");

const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in." });
  next();
};

// GET /api/avatars — 当前用户的所有小人
router.get("/", requireLogin, async (req, res) => {
  const avatars = await Avatar.find({ user: req.session.userId }).sort({ createdAt: -1 });
  const profile = await Profile.findOne({ user: req.session.userId });
  return res.json({ avatars, activeAvatarId: profile?.activeAvatar ?? null });
});

// POST /api/avatars — 新建小人，自动设为 active
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

  // 自动设为当前激活小人
  await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { activeAvatar: avatar._id }
  );

  return res.status(201).json({ avatar });
});

// PATCH /api/avatars/:id/activate — 切换激活小人
router.patch("/:id/activate", requireLogin, async (req, res) => {
  const avatar = await Avatar.findOne({ _id: req.params.id, user: req.session.userId });
  if (!avatar) return res.status(404).json({ error: "Avatar not found." });

  await Profile.findOneAndUpdate(
    { user: req.session.userId },
    { activeAvatar: avatar._id }
  );
  return res.json({ activeAvatarId: avatar._id });
});

// DELETE /api/avatars/:id — 删除小人
router.delete("/:id", requireLogin, async (req, res) => {
  const avatar = await Avatar.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
  if (!avatar) return res.status(404).json({ error: "Avatar not found." });

  // 如果删的是当前激活的，把 activeAvatar 清空
  const profile = await Profile.findOne({ user: req.session.userId });
  if (profile?.activeAvatar?.toString() === req.params.id) {
    // 找最新的其他小人顶上
    const next = await Avatar.findOne({ user: req.session.userId }).sort({ createdAt: -1 });
    await Profile.findOneAndUpdate(
      { user: req.session.userId },
      { activeAvatar: next?._id ?? null }
    );
  }
  return res.json({ ok: true });
});

export default router;
