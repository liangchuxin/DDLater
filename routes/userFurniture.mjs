import express from 'express';
import { getUserFurnitureKeys } from '../userFurnitureUtils.mjs';

const router = express.Router();

// GET /api/me/furniture — furniture keys the logged-in user owns.
router.get('/', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const keys = await getUserFurnitureKeys(req.session.userId);
  return res.json({ keys });
});

export default router;
