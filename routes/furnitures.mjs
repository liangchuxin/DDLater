import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const Furniture = mongoose.model('Furniture');

// All layout values are in px at CANVAS_REF (1435x722); frontend scales by k = canvasH/722.
const SEED = [
  {
    key: 'desk',
    name: 'Study Desk',
    capacity: 2,
    layers: 1,
    zSlot: 'char-front',                          // desk image covers the character
    imageKeys: ['desk.png'],
    isDefault: true,
    layout: {
      imgBottom: -91,                             // desk image bottom relative to canvas bottom
      imgWidth: 328,                              // desk image width
      charHalfGap: 90,                            // half distance between the two seat centers
      charBottom: 40,                             // character bottom relative to canvas bottom
      charWidth: 161,                             // width per character
    },
  },
  {
    key: 'bed',
    name: 'Loft Bed',
    capacity: 1,
    layers: 2,
    zSlot: 'char-middle',                         // bed-bottom -> character -> bed-top (sandwiched)
    imageKeys: ['bed_bottom.png', 'bed_top.png'],
    isDefault: false,
    layout: {
      bedWidth: 320,
      bedHeight: 255,
      bedOffsetY: 100,
      charWidth: 165,
      charOffsetX: 50,
      charRotation: -90,
      bottom: -40,                                // container bottom relative to canvas bottom
      sideInset: 360,                             // container center distance from nearest canvas edge
    },
  },
  {
    key: 'bean_bag',
    name: 'Bean Bag',
    capacity: 1,
    layers: 1,
    zSlot: 'char-back',                           // bean bag drawn behind the character
    imageKeys: ['bean_bag.png'],
    isDefault: false,
    layout: {
      bagWidth: 260,
      bagHeight: 200,
      bagOffsetY: 20,
      charOffsetX: 90,
      charRotation: -29,
      charBottom: -20,
      sideInset: 260,
    },
  },
  {
    key: 'sofa',
    name: 'Sofa',
    capacity: 1,
    layers: 1,
    zSlot: 'char-back',
    imageKeys: ['sofa.png'],
    isDefault: false,
    layout: {
      sofaWidth: 220,
      sofaHeight: 160,
      charTopInSofa: 140,                         // how far below the sofa top the (clipped) character's bottom sits
      charClipRows: 3,                            // pixelChar clips this many rows from the bottom (legs)
      sofaBottom: 0,
      sideInset: 260,
    },
  },
];

// GET /api/furnitures — return all furniture definitions; seeds on first access.
router.get('/', async (req, res) => {
  let furnitures = await Furniture.find();
  if (furnitures.length === 0) {
    furnitures = await Furniture.insertMany(SEED);
  }
  return res.json(furnitures);
});

// POST /api/furnitures/_reseed — DEV ONLY: wipe + reseed. Use after schema or SEED changes.
router.post('/_reseed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'reseed disabled in production' });
  }
  await Furniture.deleteMany({});
  const furnitures = await Furniture.insertMany(SEED);
  return res.json({ reseeded: furnitures.length });
});

export default router;
