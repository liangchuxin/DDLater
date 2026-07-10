import mongoose from 'mongoose';
import { isCatalogAdmin } from './adminUtils.mjs';

/** Starter pack: desk + bed + bean bag + sofa. */
export const STARTER_FURNITURE_KEYS = ['desk', 'bed', 'bean_bag', 'sofa'];

export function intersectFurnitureKeys(userKeys, roomKeys) {
  if (!Array.isArray(userKeys) || userKeys.length === 0) return [];
  if (!roomKeys?.length) return userKeys;
  const allowed = new Set(roomKeys);
  return userKeys.filter((key) => allowed.has(key));
}

async function allCatalogFurnitureKeys() {
  const Furniture = mongoose.model('Furniture');
  const keys = await Furniture.find().distinct('key');
  return keys.length > 0 ? keys : [...STARTER_FURNITURE_KEYS];
}

export async function seedStarterFurniture(userId, source = 'default') {
  const UserFurniture = mongoose.model('UserFurniture');
  const now = new Date();
  const ops = STARTER_FURNITURE_KEYS.map((furnitureKey) => ({
    updateOne: {
      filter: { user: userId, furnitureKey },
      update: {
        $setOnInsert: { user: userId, furnitureKey, source, unlockedAt: now },
      },
      upsert: true,
    },
  }));
  await UserFurniture.bulkWrite(ops, { ordered: false });
}

export async function unlockFurniture(userId, furnitureKey, source = 'unlock') {
  if (!userId || !furnitureKey) return;
  const UserFurniture = mongoose.model('UserFurniture');
  await UserFurniture.updateOne(
    { user: userId, furnitureKey },
    {
      $setOnInsert: {
        user: userId,
        furnitureKey,
        source,
        unlockedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function getUserFurnitureKeys(userId) {
  if (await isCatalogAdmin(userId)) {
    return allCatalogFurnitureKeys();
  }
  const UserFurniture = mongoose.model('UserFurniture');
  let rows = await UserFurniture.find({ user: userId }).select('furnitureKey').lean();
  if (rows.length === 0) {
    await seedStarterFurniture(userId);
    rows = await UserFurniture.find({ user: userId }).select('furnitureKey').lean();
  }
  return rows.map((row) => row.furnitureKey);
}

/** Bulk fetch for room members; lazy-seeds starter pack for users with no rows. */
export async function getUserFurnitureKeysByMembers(userIds) {
  const UserFurniture = mongoose.model('UserFurniture');
  const unique = [...new Set(userIds.filter(Boolean).map((id) => String(id)))];
  const map = new Map(unique.map((id) => [id, []]));
  if (!unique.length) return map;

  const objectIds = unique.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await UserFurniture.find({ user: { $in: objectIds } })
    .select('user furnitureKey')
    .lean();

  for (const row of rows) {
    map.get(String(row.user))?.push(row.furnitureKey);
  }

  for (const id of unique) {
    if (await isCatalogAdmin(id)) {
      map.set(id, await allCatalogFurnitureKeys());
      continue;
    }
    if (map.get(id).length === 0) {
      await seedStarterFurniture(id);
      map.set(id, [...STARTER_FURNITURE_KEYS]);
    }
  }

  return map;
}

export async function allowedFurnitureKeysForUser(userId, room) {
  const userKeys = await getUserFurnitureKeys(userId);
  return intersectFurnitureKeys(userKeys, room?.furnitures);
}
