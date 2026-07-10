import mongoose from 'mongoose';

/** Stored on User.badges; grant with scripts/grant-catalog-admin.mjs */
export const CATALOG_ADMIN_BADGE = 'catalog_admin';

function envCatalogAdminIds() {
  const raw = process.env.CATALOG_ADMIN_USER_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Full catalog access for furniture lab / testing — not room admin. */
export async function isCatalogAdmin(userId) {
  if (!userId) return false;
  const id = String(userId);

  if (envCatalogAdminIds().has(id)) return true;

  const User = mongoose.model('User');
  const user = await User.findById(userId).select('badges').lean();
  return Array.isArray(user?.badges) && user.badges.includes(CATALOG_ADMIN_BADGE);
}

/** Express middleware — furniture lab / catalog authoring. */
export async function requireCatalogAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  if (!(await isCatalogAdmin(req.session.userId))) {
    return res.status(403).json({ error: 'Catalog admin required.' });
  }
  next();
}
