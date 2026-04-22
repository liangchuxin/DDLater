// scripts/default-avatar-loader.mjs
// 读取 default-avatar-source.json（你手动放进来的那份 JSON），
// 只抽 sourceImageUrl / avatarGrid / avatarCuts 三个字段给外部用。

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, "default-avatar-source.json");

let cached = null;

export function loadDefaultAvatarData() {
  if (cached) return cached;
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(
      `default-avatar-source.json not found at ${SOURCE_PATH}. ` +
      `请把你手动准备的默认 avatar JSON 放到 scripts/default-avatar-source.json。`
    );
  }
  const raw = fs.readFileSync(SOURCE_PATH, "utf8");
  const obj = JSON.parse(raw);
  if (!obj.avatarGrid || !obj.avatarCuts) {
    throw new Error("default-avatar-source.json 缺少 avatarGrid 或 avatarCuts");
  }
  cached = {
    name: "Default Character",
    sourceImageUrl: obj.sourceImageUrl || "",
    avatarGrid: obj.avatarGrid,
    avatarCuts: obj.avatarCuts,
  };
  return cached;
}
