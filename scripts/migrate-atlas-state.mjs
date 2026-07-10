// Idempotent production migration: furniture specs + legacy layout keys,
// UserFurniture starter pack, room seat reconciliation, seat_change purge.
//
// Usage:
//   DSN="mongodb+srv://..." node scripts/migrate-atlas-state.mjs
//   node scripts/migrate-atlas-state.mjs   # uses DSN from .env

import "../config.mjs";
import mongoose from "mongoose";
import "../db.mjs";
import {
  applyDerivedSpec,
  deriveFurnitureSpec,
  furnitureNeedsSpecMigration,
} from "../furnitureUploadUtils.mjs";
import {
  getUserFurnitureKeysByMembers,
  seedStarterFurniture,
  STARTER_FURNITURE_KEYS,
} from "../userFurnitureUtils.mjs";
import {
  healCenterFurniture,
  reconcileMemberSeats,
} from "../seatUtils.mjs";

const Furniture = mongoose.model("Furniture");
const User = mongoose.model("User");
const UserFurniture = mongoose.model("UserFurniture");
const StudyRoom = mongoose.model("StudyRoom");
const RoomEvent = mongoose.model("RoomEvent");

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

/** Copy legacy layout field names to canonical keys and drop legacy keys. */
function canonicalizeFurnitureLayout(key, layout = {}) {
  const L = { ...layout };
  let changed = false;

  const mapAndDrop = (from, to) => {
    if (L[from] == null) return;
    if (L[to] == null) {
      L[to] = L[from];
      changed = true;
    }
    delete L[from];
    changed = true;
  };

  if (key === "bean_bag") {
    mapAndDrop("bagWidth", "furnitureW");
    mapAndDrop("bagHeight", "furnitureH");
    mapAndDrop("bagOffsetY", "furnitureLiftY");
    mapAndDrop("charBottom", "bottom");
  } else if (key === "sofa") {
    mapAndDrop("sofaWidth", "furnitureW");
    mapAndDrop("sofaHeight", "furnitureH");
    mapAndDrop("sofaBottom", "bottom");
    mapAndDrop("charTopInSofa", "charTopInFurniture");
  } else if (key === "bed") {
    mapAndDrop("bedWidth", "furnitureW");
    mapAndDrop("bedHeight", "furnitureH");
    mapAndDrop("bedOffsetY", "furnitureLiftY");
    if (L.charWidth != null && L.charSlotW == null) {
      L.charSlotW = L.charWidth;
      changed = true;
    }
    if (L.charWidth != null) {
      delete L.charWidth;
      changed = true;
    }
  }

  return { layout: L, changed };
}

async function migrateFurniture() {
  const furnitures = await Furniture.find({});
  let updated = 0;

  for (const furniture of furnitures) {
    const derived = deriveFurnitureSpec(furniture);
    if (!derived) {
      console.log(`  skip ${furniture.key}: no derivable spec`);
      continue;
    }

    const needsSpec = furnitureNeedsSpecMigration(furniture);
    const needsDeskLayout =
      furniture.key === "desk" &&
      (!Array.isArray(furniture.layout?.seats) ||
        furniture.layout.seats.length < (derived.capacity ?? 2));
    const { layout: canonicalLayout, changed: layoutChanged } =
      canonicalizeFurnitureLayout(furniture.key, furniture.layout ?? {});

    if (!needsSpec && !needsDeskLayout && !layoutChanged) {
      console.log(`  ok   ${furniture.key}`);
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
    } else if (layoutChanged) {
      furniture.layout = canonicalLayout;
      furniture.markModified("layout");
    }

    await furniture.save();
    updated += 1;
    console.log(
      `  fix  ${furniture.key} → zSlot=${furniture.zSlot} slotType=${furniture.slotType}`,
    );
  }

  console.log(`Furniture: updated ${updated} / ${furnitures.length}`);
  return updated;
}

async function seedMissingUserFurniture() {
  const users = await User.find({}).select("_id").lean();
  let seeded = 0;

  for (const user of users) {
    const count = await UserFurniture.countDocuments({ user: user._id });
    if (count > 0) continue;
    await seedStarterFurniture(user._id);
    seeded += 1;
  }

  console.log(
    `UserFurniture: seeded starter pack for ${seeded} user(s) (${STARTER_FURNITURE_KEYS.join(", ")})`,
  );
  return seeded;
}

async function reconcileAllRoomSeats() {
  const rooms = await StudyRoom.find({});
  let updated = 0;

  for (const room of rooms) {
    const keysByUser = await getUserFurnitureKeysByMembers(
      room.members.map((m) => m.user),
    );
    let changed = reconcileMemberSeats(room, keysByUser);
    if (healCenterFurniture(room)) changed = true;
    if (!changed) continue;
    room.markModified("members");
    await room.save();
    updated += 1;
    console.log(`  fix  room ${room.uid ?? room._id}`);
  }

  console.log(`StudyRoom seats: reconciled ${updated} / ${rooms.length} room(s)`);
  return updated;
}

async function purgeSeatChangeEvents() {
  const result = await RoomEvent.deleteMany({ type: "seat_change" });
  console.log(`RoomEvent: deleted ${result.deletedCount} seat_change row(s)`);
  return result.deletedCount;
}

async function main() {
  if (!process.env.DSN) {
    throw new Error("DSN missing — set in .env or pass on command line.");
  }

  const host = process.env.DSN.match(/@([^/?]+)/)?.[1] ?? "unknown";
  console.log(`Connecting to ${host} …\n`);

  await mongoose.connect(process.env.DSN);
  console.log("Connected.\n");

  console.log("1/4 Furniture specs + legacy layout …");
  await migrateFurniture();
  console.log();

  console.log("2/4 UserFurniture starter packs …");
  await seedMissingUserFurniture();
  console.log();

  console.log("3/4 StudyRoom seat reconciliation …");
  await reconcileAllRoomSeats();
  console.log();

  console.log("4/4 Purge seat_change history …");
  await purgeSeatChangeEvents();
  console.log();

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
