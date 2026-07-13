const CREATE_KEY = "furniture-lab-create-draft";
const VERSION_KEY = "furniture-lab-storage-version";
const STORAGE_VERSION = 3;
const editKey = (key) => `furniture-lab-edit-${key}`;

/** Drop stale edit drafts after schema/preview fixes (legacy layout keys, bad slider state). */
export function migrateLabStorage() {
  try {
    const v = Number(localStorage.getItem(VERSION_KEY));
    if (v >= STORAGE_VERSION) return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("furniture-lab-edit-")) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  } catch {
    /* ignore */
  }
}

export function loadCreateDraft() {
  try {
    const raw = localStorage.getItem(CREATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCreateDraft(draft) {
  if (!draft) {
    localStorage.removeItem(CREATE_KEY);
    return;
  }
  try {
    localStorage.setItem(CREATE_KEY, JSON.stringify(draft));
  } catch {
    /* quota — ignore */
  }
}

export function clearCreateDraft() {
  localStorage.removeItem(CREATE_KEY);
}

export function loadEditDraft(furnitureKey) {
  if (!furnitureKey) return null;
  try {
    const raw = localStorage.getItem(editKey(furnitureKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveEditDraft(furnitureKey, layout) {
  if (!furnitureKey || !layout) return;
  try {
    localStorage.setItem(editKey(furnitureKey), JSON.stringify({ layout }));
  } catch {
    /* ignore */
  }
}

export function clearEditDraft(furnitureKey) {
  if (!furnitureKey) return;
  localStorage.removeItem(editKey(furnitureKey));
}

export function layoutsEqual(a, b) {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}
