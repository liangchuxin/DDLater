import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, "default-avatar-source.json");

let cached = null;

export function loadDefaultAvatarData() {
  if (cached) return cached;
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`default-avatar-source.json not found at ${SOURCE_PATH}. `);
  }
  const raw = fs.readFileSync(SOURCE_PATH, "utf8");
  const obj = JSON.parse(raw);
  if (!obj.avatarGrid || !obj.avatarCuts) {
    throw new Error(
      "default-avatar-source.json missing avatarGrid or avatarCuts",
    );
  }
  cached = {
    name: "Default Character",
    sourceImageUrl: obj.sourceImageUrl || "",
    avatarGrid: obj.avatarGrid,
    avatarCuts: obj.avatarCuts,
  };
  return cached;
}
