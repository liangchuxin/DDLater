import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const router = express.Router();
const User = mongoose.model("User");

router.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const existing = await User.findOne({ username });

  if (existing) {
    return res.status(400).json({ error: "User already exists." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = new User({ username, hash });

  await user.save();
  return res.json({ message: "Registration success." });
});

router.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const existing = await User.findOne({ username });

  if (!existing) {
    return res.status(400).json({ error: "User not found." });
  }
  const match = bcrypt.compareSync(password, existing.hash);
  if (!match) {
    return res
      .status(400)
      .json({ error: "Password and username do not match." });
  }
  req.session.userId = existing._id;
  return res.json({ _id: existing._id, username: existing.username });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const user = await User.findById(req.session.userId);
  return res.json({ _id: user._id, username: user.username });
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  return res.json({ message: "Logged out." });
});

export default router;

// router.post("/login", async (req, res) => {});
