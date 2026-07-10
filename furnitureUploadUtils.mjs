import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOM_ASSETS_DIR = path.join(__dirname, 'client/public/room');

const SAFE_NAME = /^[a-z0-9][a-z0-9_-]{0,63}\.png$/i;

export function slugifyFurnitureKey(name) {
  return String(name ?? 'furniture')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'furniture';
}

export function parseImagePayload(dataUrl, fallbackName) {
  const raw = String(dataUrl ?? "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error('Image must be a base64 data URL (png/jpeg/webp).');
  }
  const mime = match[1].toLowerCase();
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const base = String(fallbackName ?? "furniture")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();
  const filename = `${base}.${ext}`;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpe?g|webp)$/i.test(filename)) {
    throw new Error(`Invalid image filename: ${filename}`);
  }
  return {
    filename,
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function roomImageFilename(key, index, imageCount, ext = "png") {
  const safeKey = String(key).replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const suffix =
    imageCount > 1 ? (index === 0 ? "_bottom" : "_top") : "";
  return `${safeKey}${suffix}.${ext}`;
}

export async function writeRoomImage(filename, buffer) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpe?g|webp)$/i.test(filename)) {
    throw new Error('Invalid filename.');
  }
  await fs.mkdir(ROOM_ASSETS_DIR, { recursive: true });
  const dest = path.join(ROOM_ASSETS_DIR, filename);
  await fs.writeFile(dest, buffer);
  return filename;
}

export async function deleteRoomImages(imageKeys = []) {
  for (const filename of imageKeys) {
    if (!filename || /^(https?:|blob:|\/)/.test(filename)) continue;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpe?g|webp)$/i.test(filename)) continue;
    const dest = path.join(ROOM_ASSETS_DIR, filename);
    try {
      await fs.unlink(dest);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

const LEGACY_TEMPLATE_SPEC = {
  'side-char-back': { zSlot: 'char-back', layers: 1, slotType: 'side', capacity: 1 },
  'side-char-front': { zSlot: 'char-front', layers: 1, slotType: 'side', capacity: 1 },
  'side-sandwich': { zSlot: 'char-middle', layers: 2, slotType: 'side', capacity: 1 },
  'center-shared': { zSlot: 'char-front', layers: 1, slotType: 'center', capacity: 2 },
};

/** Default seed keys that predate slotType / capacity fields. */
const LEGACY_KEY_SPEC = {
  bean_bag: { zSlot: 'char-back', layers: 1, slotType: 'side', capacity: 1 },
  sofa: { zSlot: 'char-back', layers: 1, slotType: 'side', capacity: 1 },
  bed: { zSlot: 'char-middle', layers: 2, slotType: 'side', capacity: 1 },
  desk: { zSlot: 'char-front', layers: 1, slotType: 'center', capacity: 2 },
};

export function imageCountForSpec(spec) {
  return spec?.layers === 2 ? 2 : 1;
}

export function validateFurnitureSpec(raw = {}) {
  let spec = { ...raw };

  const hasExplicitSpec =
    spec.zSlot &&
    spec.slotType != null &&
    spec.layers != null &&
    spec.capacity != null;

  if (raw.renderTemplate) {
    if (LEGACY_TEMPLATE_SPEC[raw.renderTemplate]) {
      spec = { ...LEGACY_TEMPLATE_SPEC[raw.renderTemplate], ...spec };
    } else if (!hasExplicitSpec) {
      return { error: 'Invalid renderTemplate.' };
    }
  }

  const zSlot = spec.zSlot;
  const layers = Number(spec.layers);
  const slotType = spec.slotType;
  const capacity = Number(spec.capacity);

  const errors = [];
  if (!['char-back', 'char-front', 'char-middle'].includes(zSlot)) {
    errors.push('Invalid zSlot.');
  }
  if (!Number.isFinite(layers) || layers < 1 || layers > 2) {
    errors.push('layers must be 1 or 2.');
  }
  if (zSlot === 'char-middle' && layers !== 2) {
    errors.push('char-middle requires layers: 2.');
  }
  if (zSlot !== 'char-middle' && layers !== 1) {
    errors.push(`${zSlot} requires layers: 1.`);
  }
  if (!['side', 'center'].includes(slotType)) {
    errors.push('Invalid slotType.');
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    errors.push('capacity must be at least 1.');
  }
  if (capacity === 1 && slotType !== 'side') {
    errors.push('Single seat must use slotType side.');
  }
  if (capacity >= 2 && slotType !== 'center') {
    errors.push('Multi-seat must use slotType center.');
  }
  if (capacity >= 2 && zSlot === 'char-middle') {
    errors.push('Sandwiched layer is only supported for single side seats for now.');
  }
  if (capacity >= 2 && capacity !== 2) {
    errors.push('Only dual (capacity 2) center seats are supported for now.');
  }

  if (errors.length) return { error: errors.join(' ') };

  return {
    spec: { zSlot, layers, slotType, capacity },
    imageCount: imageCountForSpec({ layers }),
  };
}

/** Resolve spec from stored fields, renderTemplate, or legacy key defaults. */
export function deriveFurnitureSpec(furniture) {
  if (!furniture) return null;

  if (
    furniture.zSlot &&
    furniture.slotType != null &&
    furniture.layers != null &&
    furniture.capacity != null
  ) {
    const result = validateFurnitureSpec(furniture);
    if (!result.error) return result.spec;
  }

  if (furniture.renderTemplate && LEGACY_TEMPLATE_SPEC[furniture.renderTemplate]) {
    return { ...LEGACY_TEMPLATE_SPEC[furniture.renderTemplate] };
  }
  if (LEGACY_KEY_SPEC[furniture.key]) {
    return { ...LEGACY_KEY_SPEC[furniture.key] };
  }
  return null;
}

export function furnitureNeedsSpecMigration(furniture) {
  const derived = deriveFurnitureSpec(furniture);
  if (!derived) return false;
  return (
    furniture.zSlot !== derived.zSlot ||
    furniture.slotType !== derived.slotType ||
    furniture.layers !== derived.layers ||
    furniture.capacity !== derived.capacity
  );
}

export function applyDerivedSpec(furniture, derived) {
  furniture.zSlot = derived.zSlot;
  furniture.slotType = derived.slotType;
  furniture.layers = derived.layers;
  furniture.capacity = derived.capacity;
}

/** @deprecated accept renderTemplate on POST for old clients */
export const TEMPLATE_META = Object.fromEntries(
  Object.entries(LEGACY_TEMPLATE_SPEC).map(([id, spec]) => [
    id,
    { ...spec, imageCount: imageCountForSpec(spec) },
  ]),
);

export function extFromMime(mime = '') {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  return 'png';
}
