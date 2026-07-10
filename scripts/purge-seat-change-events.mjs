// Delete persisted seat_change rows from RoomEvent (history-only cleanup).
//
// Usage:
//   node scripts/purge-seat-change-events.mjs
//   DSN="mongodb+srv://..." node scripts/purge-seat-change-events.mjs

import "../config.mjs";
import mongoose from "mongoose";
import "../db.mjs";

const RoomEvent = mongoose.model("RoomEvent");

async function main() {
  if (!process.env.DSN) {
    throw new Error("DSN missing — set in .env or pass on command line.");
  }

  await mongoose.connect(process.env.DSN);
  const result = await RoomEvent.deleteMany({ type: "seat_change" });
  console.log(`Deleted ${result.deletedCount} seat_change event(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
