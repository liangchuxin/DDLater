import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const Furniture = mongoose.model('Furniture');

// 所有 layout 数值都是 px @ CANVAS_REF (1435×722)，前端按 k = canvasH/722 缩放
const SEED = [
  {
    key: 'desk',
    name: 'Study Desk',
    capacity: 2,
    layers: 1,
    zSlot: 'char-front',                          // 桌子图遮住人
    imageKeys: ['desk.png'],
    isDefault: true,
    layout: {
      imgBottom: -91,                             // 桌子图 bottom 相对 canvas 底
      imgWidth: 328,                              // 桌子图宽
      charHalfGap: 90,                            // 两人中心间距的一半
      charBottom: 40,                             // 两人 bottom 相对 canvas 底
      charWidth: 161,                             // 每人宽
    },
  },
  {
    key: 'bed',
    name: 'Loft Bed',
    capacity: 1,
    layers: 2,
    zSlot: 'char-middle',                         // 床底 → 人 → 床上（夹在中间）
    imageKeys: ['bed_bottom.png', 'bed_top.png'],
    isDefault: false,
    layout: {
      bedWidth: 320,
      bedHeight: 255,
      bedOffsetY: 100,
      charWidth: 165,
      charOffsetX: 50,
      charRotation: -90,
      bottom: -40,                                // 容器 bottom 相对 canvas 底
      sideInset: 360,                             // 容器中心距最近 canvas 边
    },
  },
  {
    key: 'bean_bag',
    name: 'Bean Bag',
    capacity: 1,
    layers: 1,
    zSlot: 'char-back',                           // 懒人沙发在人后
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
      charTopInSofa: 140,                         // 人（裁腿后）底部在沙发顶下方多少
      charClipRows: 3,                            // pixelChar 从底部砍掉几行（腿）
      sofaBottom: 0,
      sideInset: 260,
    },
  },
];

// GET /api/furnitures — 返回所有家具定义，首次访问自动 seed
router.get('/', async (req, res) => {
  let furnitures = await Furniture.find();
  if (furnitures.length === 0) {
    furnitures = await Furniture.insertMany(SEED);
  }
  return res.json(furnitures);
});

// POST /api/furnitures/_reseed — DEV ONLY: 清空 + 重新 seed。改 schema 或 SEED 后用。
router.post('/_reseed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'reseed disabled in production' });
  }
  await Furniture.deleteMany({});
  const furnitures = await Furniture.insertMany(SEED);
  return res.json({ reseeded: furnitures.length });
});

export default router;
