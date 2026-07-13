// Upsert scripts/furniture-catalog.json → MongoDB (local or Atlas).
// Edit the JSON in git, then run against each DSN to keep environments aligned.
//
// Usage:
//   npm run sync:furniture              # uses DSN from .env (local ddlater_dev)
//   npm run sync:furniture:prod         # requires DSN= Atlas connection in env
//   DSN="mongodb+srv://..." node scripts/sync-furniture-catalog.mjs
//   node scripts/sync-furniture-catalog.mjs --file scripts/furniture-catalog.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "../config.mjs";
import mongoose from "mongoose";
import "../db.mjs";
import {
  applyDerivedSpec,
  deriveFurnitureSpec,
  validateFurnitureSpec,
} from "../furnitureUploadUtils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const Furniture = mongoose.model("Furniture");

function dsnEnvironment(dsn) {
  if (/127\.0\.0\.1|localhost/.test(dsn)) return "development";
  if (/mongodb\.net|mongodb\+srv:/.test(dsn)) return "production";
  return "unknown";
}

function parseEnvFlag() {
  const i = process.argv.indexOf("--env");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

function catalogPathFromArgs() {
  const i = process.argv.indexOf("--file");
  if (i >= 0 && process.argv[i + 1]) {
    return path.resolve(process.argv[i + 1]);
  }
  return path.join(__dirname, "furniture-catalog.json");
}

function stripDoc(raw) {
  const { _id, __v, createdAt, updatedAt, _assetV, ...rest } = raw;
  return rest;
}

async function main() {
  const file = catalogPathFromArgs();
  if (!process.env.DSN) {
    throw new Error("DSN missing — set in .env or pass on command line.");
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Catalog not found: ${file}`);
  }

  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(items)) {
    throw new Error("Catalog JSON must be an array.");
  }

  const envFlag = parseEnvFlag();
  const env = envFlag ?? dsnEnvironment(process.env.DSN);
  if (envFlag === "production" && env !== "production") {
    throw new Error(
      "sync:furniture:prod requires an Atlas DSN (mongodb+srv://…). Set DSN in the shell.",
    );
  }

  const host = process.env.DSN.match(/@([^/?]+)/)?.[1] ?? process.env.DSN;
  console.log(
    `Sync ${items.length} furniture doc(s) → ${host} [${env}]\n`,
  );

  await mongoose.connect(process.env.DSN);
  let inserted = 0;
  let updated = 0;

  for (const raw of items) {
    const key = raw.key?.trim();
    if (!key) continue;

    const doc = stripDoc(raw);
    let derived = deriveFurnitureSpec(doc);
    if (!derived) {
      const validated = validateFurnitureSpec(doc);
      if (validated.error) {
        console.log(`skip ${key}: ${validated.error}`);
        continue;
      }
      derived = validated.spec;
    }
    applyDerivedSpec(doc, derived);

    const existing = await Furniture.findOne({ key });
    if (existing) {
      Object.assign(existing, doc);
      existing.markModified("layout");
      await existing.save();
      updated += 1;
      console.log(
        `update ${key} → ${existing.slotType} · capacity ${existing.capacity}`,
      );
    } else {
      await Furniture.create(doc);
      inserted += 1;
      console.log(`insert ${key} → ${doc.slotType} · capacity ${doc.capacity}`);
    }
  }

  const keysInCatalog = new Set(items.map((i) => i.key));
  const orphans = await Furniture.find({
    key: { $nin: [...keysInCatalog] },
  }).select("key");
  if (orphans.length) {
    console.log(
      `\nNote: ${orphans.length} DB doc(s) not in catalog:`,
      orphans.map((o) => o.key).join(", "),
    );
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
