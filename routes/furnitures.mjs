import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import {
  deleteRoomImages,
  extFromMime,
  parseImagePayload,
  roomImageFilename,
  slugifyFurnitureKey,
  deriveFurnitureSpec,
  furnitureNeedsSpecMigration,
  applyDerivedSpec,
  validateFurnitureSpec,
  writeRoomImage,
} from '../furnitureUploadUtils.mjs';
import { unlockFurniture } from '../userFurnitureUtils.mjs';
import { requireCatalogAdmin } from '../adminUtils.mjs';

const router = express.Router();
const Furniture = mongoose.model('Furniture');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 2 },
});

const requireDev = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Furniture authoring disabled in production.' });
  }
  next();
};

function normalizeKey(keyInput, name) {
  const key = keyInput?.trim() || slugifyFurnitureKey(name);
  const normalizedKey = /^[a-z]/.test(key) ? key : `f_${key.replace(/^[^a-z]+/, '')}`;
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(normalizedKey)) {
    return { error: 'Invalid key.' };
  }
  return { normalizedKey };
}

function parseLayoutField(layout) {
  if (layout == null) return { error: 'layout object required' };
  if (typeof layout === 'object') return { layout };
  if (typeof layout === 'string') {
    try {
      const parsed = JSON.parse(layout);
      if (typeof parsed !== 'object' || !parsed) {
        return { error: 'layout object required' };
      }
      return { layout: parsed };
    } catch {
      return { error: 'layout must be valid JSON.' };
    }
  }
  return { error: 'layout object required' };
}

async function createFurnitureRecord({
  keyInput,
  name,
  zSlot,
  slotType,
  layers,
  capacity,
  renderTemplate,
  layout,
  imageBuffers,
}) {
  const validated = validateFurnitureSpec({
    zSlot,
    slotType,
    layers,
    capacity,
    renderTemplate,
  });
  if (validated.error) {
    return { status: 400, error: validated.error };
  }
  const { spec, imageCount } = validated;

  if (!name?.trim()) {
    return { status: 400, error: 'name required.' };
  }
  const layoutResult = parseLayoutField(layout);
  if (layoutResult.error) {
    return { status: 400, error: layoutResult.error };
  }
  if (!Array.isArray(imageBuffers) || imageBuffers.length !== imageCount) {
    return {
      status: 400,
      error: `This configuration requires ${imageCount} image(s).`,
    };
  }

  const keyResult = normalizeKey(keyInput, name);
  if (keyResult.error) {
    return { status: 400, error: keyResult.error };
  }
  const { normalizedKey } = keyResult;

  const existing = await Furniture.findOne({ key: normalizedKey });
  if (existing) {
    return { status: 409, error: `Furniture key "${normalizedKey}" already exists.` };
  }

  const imageKeys = [];
  for (let i = 0; i < imageBuffers.length; i += 1) {
    const slot = imageBuffers[i];
    const buffer = slot?.buffer;
    if (!buffer?.length) {
      return { status: 400, error: `Image ${i + 1} data missing.` };
    }
    const ext = slot.ext || 'png';
    const saved = await writeRoomImage(
      roomImageFilename(normalizedKey, i, imageCount, ext),
      buffer,
    );
    imageKeys.push(saved);
  }

  const furniture = await Furniture.create({
    key: normalizedKey,
    name: name.trim(),
    capacity: spec.capacity,
    layers: spec.layers,
    zSlot: spec.zSlot,
    slotType: spec.slotType,
    renderTemplate: null,
    layout: layoutResult.layout,
    imageKeys,
    isDefault: false,
  });
  return { status: 201, furniture };
}

// All layout values are in px at CANVAS_REF (1435x722); frontend scales by k = canvasH/722.
const SEED = [
  {
    key: 'desk',
    name: 'Study Desk',
    capacity: 2,
    layers: 1,
    zSlot: 'char-front',
    slotType: 'center',
    renderTemplate: null,
    imageKeys: ['desk.png'],
    isDefault: true,
    layout: {
      imgBottom: -91,
      imgWidth: 328,
      charHalfGap: 90,
      charBottom: 47,
      charWidth: 161,
      seats: [
        { charWidth: 161, charOffsetX: 0, charOffsetY: 0, charRotation: 0 },
        { charWidth: 161, charOffsetX: 0, charOffsetY: 0, charRotation: 0 },
      ],
    },
  },
  {
    key: 'bed',
    name: 'Loft Bed',
    capacity: 1,
    layers: 2,
    zSlot: 'char-middle',
    slotType: 'side',
    renderTemplate: 'side-sandwich',
    imageKeys: ['bed_bottom.png', 'bed_top.png'],
    isDefault: false,
    layout: {
      bottom: -40,
      sideInset: 360,
      furnitureW: 320,
      furnitureH: 255,
      furnitureLiftY: 100,
      charOffsetX: 50,
      charOffsetY: 0,
      charRotation: -90,
      charAnchor: 'top',
      charSlotW: 165,
    },
  },
  {
    key: 'bean_bag',
    name: 'Bean Bag',
    capacity: 1,
    layers: 1,
    zSlot: 'char-back',
    slotType: 'side',
    renderTemplate: 'side-char-back',
    imageKeys: ['bean_bag.png'],
    isDefault: false,
    layout: {
      bottom: -20,
      sideInset: 260,
      furnitureW: 260,
      furnitureH: 200,
      furnitureLiftY: 20,
      charOffsetX: 62,
      charRotation: -29,
      charAlign: 'offset',
    },
  },
  {
    key: 'sofa',
    name: 'Sofa',
    capacity: 1,
    layers: 1,
    zSlot: 'char-back',
    slotType: 'side',
    renderTemplate: 'side-char-back',
    imageKeys: ['sofa.png'],
    isDefault: false,
    layout: {
      bottom: 0,
      sideInset: 260,
      furnitureW: 220,
      furnitureH: 160,
      charClipRows: 3,
      charAlign: 'center',
      charTopInFurniture: 140,
    },
  },
];

// GET /api/furnitures — return all furniture definitions; seeds on first access.
router.get('/', async (req, res) => {
  let furnitures = await Furniture.find();
  if (furnitures.length === 0) {
    furnitures = await Furniture.insertMany(SEED);
  }
  for (const furniture of furnitures) {
    if (furnitureNeedsSpecMigration(furniture)) {
      applyDerivedSpec(furniture, deriveFurnitureSpec(furniture));
      await furniture.save();
    }
  }
  return res.json(furnitures);
});

function parseJsonImages(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// POST /api/furnitures — create furniture + save uploaded images (dev lab).
router.post('/', requireDev, requireCatalogAdmin, (req, res, next) => {
  const ct = req.headers['content-type'] ?? '';
  if (ct.includes('multipart/form-data')) {
    return upload.array('images', 2)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed.' });
      }
      next();
    });
  }
  next();
}, async (req, res) => {
  try {
    const {
      key: keyInput,
      name,
      zSlot,
      slotType,
      layers,
      capacity,
      renderTemplate,
      layout,
    } = req.body ?? {};

    let imageBuffers = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      imageBuffers = req.files.map((file) => ({
        buffer: file.buffer,
        ext: extFromMime(file.mimetype),
      }));
    } else {
      const images = parseJsonImages(req.body?.images);
      imageBuffers = images.map((slot, i) => {
        const { buffer } = parseImagePayload(
          slot?.data ?? slot?.dataUrl,
          `${keyInput || slugifyFurnitureKey(name)}_${i}.png`,
        );
        const mime = String(slot?.data ?? slot?.dataUrl ?? '').match(/^data:(image\/[^;]+)/i)?.[1];
        return { buffer, ext: extFromMime(mime ?? 'image/png') };
      });
    }

    const result = await createFurnitureRecord({
      keyInput,
      name,
      zSlot,
      slotType,
      layers: layers != null ? Number(layers) : undefined,
      capacity: capacity != null ? Number(capacity) : undefined,
      renderTemplate,
      layout,
      imageBuffers,
    });
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    if (req.session?.userId) {
      await unlockFurniture(req.session.userId, result.furniture.key, 'upload');
    }
    return res.status(result.status).json(result.furniture);
  } catch (err) {
    console.error('POST /api/furnitures', err);
    return res.status(400).json({ error: err.message || 'Failed to create furniture.' });
  }
});

// POST /api/furnitures/_reseed — DEV ONLY: wipe + reseed. Use after schema or SEED changes.
router.post('/_reseed', requireDev, requireCatalogAdmin, async (req, res) => {
  await Furniture.deleteMany({});
  const furnitures = await Furniture.insertMany(SEED);
  return res.json({ reseeded: furnitures.length });
});

async function replaceFurnitureImages(furniture, slotsByIndex) {
  const imageCount = furniture.layers === 2 ? 2 : 1;
  const imageKeys = [...(furniture.imageKeys ?? [])];
  while (imageKeys.length < imageCount) {
    imageKeys.push(
      roomImageFilename(furniture.key, imageKeys.length, imageCount, 'png'),
    );
  }

  for (const [indexStr, slot] of Object.entries(slotsByIndex)) {
    const index = Number(indexStr);
    if (Number.isNaN(index) || index < 0 || index >= imageCount) continue;
    const buffer = slot?.buffer;
    if (!buffer?.length) continue;
    const ext = slot.ext || 'png';
    const filename =
      imageKeys[index] ??
      roomImageFilename(furniture.key, index, imageCount, ext);
    await writeRoomImage(filename, buffer);
    imageKeys[index] = filename;
  }

  return imageKeys;
}

// PATCH /api/furnitures/:key — update layout and/or replace images (dev lab).
const patchImageUpload = upload.fields([
  { name: 'image0', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
]);

function parsePatchImageSlots(req) {
  const slots = {};
  for (let i = 0; i < 2; i += 1) {
    const file = req.files?.[`image${i}`]?.[0];
    if (!file?.buffer?.length) continue;
    slots[i] = {
      buffer: file.buffer,
      ext: extFromMime(file.mimetype),
    };
  }
  return slots;
}

router.patch('/:key', requireDev, requireCatalogAdmin, (req, res, next) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('multipart/form-data')) return next();
  return patchImageUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  const { key } = req.params;
  const update = {};

  if (req.body?.layout != null) {
    let layout = req.body.layout;
    if (typeof layout === 'string') {
      try {
        layout = JSON.parse(layout);
      } catch {
        return res.status(400).json({ error: 'layout must be valid JSON.' });
      }
    }
    if (typeof layout !== 'object' || layout === null) {
      return res.status(400).json({ error: 'layout object required' });
    }
    update.layout = layout;
  }

  if (req.body?.name != null) {
    update.name = req.body.name;
  }

  try {
    const furniture = await Furniture.findOne({ key });
    if (!furniture) {
      return res.status(404).json({ error: 'Furniture not found' });
    }

    const imageSlots = parsePatchImageSlots(req);

    if (Object.keys(imageSlots).length > 0) {
      update.imageKeys = await replaceFurnitureImages(furniture, imageSlots);
    }

    if (!Object.keys(update).length) {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.startsWith('multipart/form-data')) {
        return res.status(400).json({
          error:
            'No image files received. Restart the API server if upload support was recently added.',
        });
      }
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const updated = await Furniture.findOneAndUpdate({ key }, update, { new: true });
    return res.json(updated);
  } catch (err) {
    console.error('PATCH /api/furnitures/:key', err);
    return res.status(500).json({ error: 'Failed to update furniture' });
  }
});

// DELETE /api/furnitures/:key — remove custom furniture (dev lab).
router.delete('/:key', requireDev, requireCatalogAdmin, async (req, res) => {
  const { key } = req.params;
  try {
    const furniture = await Furniture.findOne({ key });
    if (!furniture) {
      return res.status(404).json({ error: 'Furniture not found' });
    }
    if (furniture.isDefault) {
      return res.status(403).json({ error: 'Default seed furniture cannot be deleted.' });
    }
    await deleteRoomImages(furniture.imageKeys);
    await Furniture.deleteOne({ key });
    return res.json({ deleted: key });
  } catch (err) {
    console.error('DELETE /api/furnitures/:key', err);
    return res.status(500).json({ error: 'Failed to delete furniture' });
  }
});

export default router;
