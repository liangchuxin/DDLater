// 一次性(可多次跑)脚本: 保证每个 profile 都有一个 isDefault: true 的 avatar。
//
// 逻辑:
//   1. 已有 isDefault: true 的 avatar -> 跳过
//   2. 有 name="Default Character" 的 avatar (上次 seed 建但没标记) -> 打标记
//   3. 都没有 -> 新建一条 isDefault: true 的 avatar
//   4. activeAvatar 为 null 的才 set 指向 default, 否则不动
//
// 跑法:  node scripts/seed-default-avatars.mjs

import "../config.mjs";
import mongoose from "mongoose";
import "../db.mjs";
import { loadDefaultAvatarData } from "./default-avatar-loader.mjs";

const Profile = mongoose.model("Profile");
const Avatar = mongoose.model("Avatar");

async function main() {
  if (!process.env.DSN) {
    throw new Error("DSN 不在环境变量里,检查 .env");
  }
  console.log("连接 mongo...");
  await mongoose.connect(process.env.DSN);
  console.log("已连接");

  const defaultData = loadDefaultAvatarData();
  console.log(
    `默认 avatar 数据已加载 (grid ${defaultData.avatarGrid.length} 行)\n`,
  );

  const profiles = await Profile.find({});
  console.log(`总共 ${profiles.length} 个 profile\n`);

  let skipped = 0; // 已经有 isDefault avatar, 什么都没做
  let marked = 0; // 旧的 "Default Character" 条目被打上 isDefault 标记
  let created = 0; // 新建了 default avatar
  let activeSet = 0; // 顺便把 activeAvatar 从 null set 成 default

  for (const profile of profiles) {
    const label = profile.displayName ?? profile.uid ?? profile._id;

    // 1. 已有 isDefault: true
    let defaultAvatar = await Avatar.findOne({
      user: profile.user,
      isDefault: true,
    });
    if (defaultAvatar) {
      skipped++;
      console.log(`  · ${label}: 已有 default, 跳过`);
    } else {
      // 2. 有老的 "Default Character" 没打标记
      const legacy = await Avatar.findOne({
        user: profile.user,
        name: "Default Character",
      });
      if (legacy) {
        legacy.isDefault = true;
        await legacy.save();
        defaultAvatar = legacy;
        marked++;
        console.log(`  ~ ${label}: 旧 Default Character 打标记`);
      } else {
        // 3. 新建
        defaultAvatar = await Avatar.create({
          user: profile.user,
          name: defaultData.name,
          sourceImageUrl: defaultData.sourceImageUrl,
          avatarGrid: defaultData.avatarGrid,
          avatarCuts: defaultData.avatarCuts,
          isDefault: true,
        });
        created++;
        console.log(`  + ${label}: 新建 default avatar`);
      }
    }

    // 4. activeAvatar 为 null 才 set
    if (!profile.activeAvatar) {
      profile.activeAvatar = defaultAvatar._id;
      await profile.save();
      activeSet++;
    }
  }

  console.log(
    `\n完成: 跳过 ${skipped}, 打标记 ${marked}, 新建 ${created}, 顺便 set activeAvatar ${activeSet}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
