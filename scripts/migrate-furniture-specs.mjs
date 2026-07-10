// One-time (idempotent) migration: write canonical zSlot / slotType / layers / capacity
// onto Furniture documents. Safe to run on dev or production Atlas.
//
// Usage:
//   node scripts/migrate-furniture-specs.mjs
//   DSN="mongodb+srv://..." node scripts/migrate-furniture-specs.mjs

import "../config.mjs";
import mongoose from "mongoose";
import "../db.mjs";
import {
  applyDerivedSpec,
  deriveFurnitureSpec,
  furnitureNeedsSpecMigration,
} from "../furnitureUploadUtils.mjs";

const Furniture = mongoose.model("Furniture");

function normalizeDeskLayoutInDb(layout = {}, capacity = 2) {
  if (Array.isArray(layout.seats) && layout.seats.length >= capacity) {
    return layout;
  }
  const charWidth = layout.charWidth ?? 161;
  return {
    ...layout,
    seats: Array.from({ length: capacity }, (_, i) => ({
      charWidth: layout.seats?.[i]?.charWidth ?? charWidth,
      charOffsetX: layout.seats?.[i]?.charOffsetX ?? 0,
      charOffsetY: layout.seats?.[i]?.charOffsetY ?? 0,
      charRotation: layout.seats?.[i]?.charRotation ?? 0,
    })),
  };
}

async function main() {
  if (!process.env.DSN) {
    throw new Error("DSN missing — set in .env or pass on command line.");
  }

  await mongoose.connect(process.env.DSN);
  console.log("Connected.\n");

  const furnitures = await Furniture.find({});
  let updated = 0;

  for (const furniture of furnitures) {
    const derived = deriveFurnitureSpec(furniture);
    if (!derived) {
      console.log(`skip ${furniture.key}: no derivable spec`);
      continue;
    }

    const needsSpec = furnitureNeedsSpecMigration(furniture);
    const needsDeskLayout =
      furniture.key === "desk" &&
      (!Array.isArray(furniture.layout?.seats) ||
        furniture.layout.seats.length < (derived.capacity ?? 2));

    if (!needsSpec && !needsDeskLayout) {
      console.log(`ok   ${furniture.key}`);
      continue;
    }

    if (needsSpec) {
      applyDerivedSpec(furniture, derived);
      if (furniture.renderTemplate && furniture.key === "desk") {
        furniture.renderTemplate = null;
      }
    }
    if (needsDeskLayout) {
      furniture.layout = normalizeDeskLayoutInDb(
        furniture.layout ?? {},
        derived.capacity ?? 2,
      );
      furniture.markModified("layout");
    }

    await furniture.save();
    updated += 1;
    console.log(
      `fix  ${furniture.key} → zSlot=${furniture.zSlot} slotType=${furniture.slotType} capacity=${furniture.capacity}`,
    );
  }

  console.log(`\nDone. Updated ${updated} / ${furnitures.length} furniture doc(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
