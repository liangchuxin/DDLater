// 纯工具函数，不持有 state。

export function pctClass(pct) {
  if (pct === 100) return "done";
  if (pct < 30) return "urgent";
  if (pct < 60) return "warn";
  return "";
}

export function formatDue(d) {
  if (!d) return "no due date";
  const due = new Date(d);
  const diff = due - new Date();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return "overdue";
  if (hours < 24) return `due in ${hours}h`;
  if (days === 1) return "due tomorrow";
  if (days <= 7) return `due in ${days}d`;
  return `due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// 从 img 元素读最主要的颜色，用于 badge 边框/阴影。
export function getDominantColor(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0, 50, 50);
  const data = ctx.getImageData(0, 0, 50, 50).data;
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    const k = `${Math.round(data[i] / 32) * 32},${Math.round(data[i + 1] / 32) * 32},${Math.round(data[i + 2] / 32) * 32}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  const [r, g, b] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0][0]
    .split(",");
  return `rgb(${r},${g},${b})`;
}

// 随机分配座位。调用一次，结果稳定传给 RoomScene。
// 规则：self (memberIdx=0) 随机坐桌子左/右；剩余客人一个可能坐桌子另一侧，
// 其余分配 side 家具。
export function generateSeats(memberCount, furnitures) {
  const desk = furnitures.find((f) => f.key === "desk");
  const pool = [...furnitures.filter((f) => f.key !== "desk")].sort(
    () => Math.random() - 0.5,
  );
  const adminDeskSlot = Math.random() < 0.5 ? 0 : 1;
  const sides = Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
  const seats = [];
  if (desk) {
    if (memberCount > 0)
      seats.push({
        memberIdx: 0,
        furniture: desk,
        slotIndex: adminDeskSlot,
        position: "center",
      });
    if (memberCount > 1)
      seats.push({
        memberIdx: 1,
        furniture: desk,
        slotIndex: 1 - adminDeskSlot,
        position: "center",
      });
  }
  if (pool[0] && memberCount > 2)
    seats.push({
      memberIdx: 2,
      furniture: pool[0],
      slotIndex: 0,
      position: sides[0],
    });
  if (pool[1] && memberCount > 3)
    seats.push({
      memberIdx: 3,
      furniture: pool[1],
      slotIndex: 0,
      position: sides[1],
    });
  return seats;
}

// 在现有 seats 基础上增量补座位。
// 已占位的 memberIdx 不动；缺座的 memberIdx 按简单策略补上。
// 策略：优先填空的桌子坐位 → 然后填侧面家具左/右。如果连 side 床沿/沙发 都满了，晚来的人就不渲染在场景里（床位就这么多，MVP 正常）。
export function extendSeats(existingSeats, memberCount, furnitures) {
  const taken = new Set(existingSeats.map((s) => s.memberIdx));
  const occupiedDeskSlots = new Set(
    existingSeats
      .filter((s) => s.position === "center")
      .map((s) => s.slotIndex),
  );
  const occupiedSides = new Set(
    existingSeats.filter((s) => s.position !== "center").map((s) => s.position),
  );
  const desk = furnitures.find((f) => f.key === "desk");
  const sidePool = furnitures.filter((f) => f.key !== "desk");

  const seats = [...existingSeats];
  for (let i = 0; i < memberCount; i++) {
    if (taken.has(i)) continue;
    // 1) 桓子有空位就坐桌子
    if (desk) {
      const freeDeskSlot = [0, 1].find((s) => !occupiedDeskSlots.has(s));
      if (freeDeskSlot !== undefined) {
        seats.push({
          memberIdx: i,
          furniture: desk,
          slotIndex: freeDeskSlot,
          position: "center",
        });
        occupiedDeskSlots.add(freeDeskSlot);
        continue;
      }
    }
    // 2) 侧位：左边或右边有空就坐对应 side 家具
    const freeSide = ["left", "right"].find((s) => !occupiedSides.has(s));
    if (freeSide && sidePool.length > 0) {
      const furniture = sidePool[Math.floor(Math.random() * sidePool.length)];
      seats.push({
        memberIdx: i,
        furniture,
        slotIndex: 0,
        position: freeSide,
      });
      occupiedSides.add(freeSide);
      continue;
    }
  }
  return seats;
}

// Side slot 中心 x：受 sideInset（离最近垂直边） 和 minFromCenter（离 canvas 中心）
// 两个约束夹紧，防止窄屏下家具撞桌子。
export function sideCenterX(position, sideInset, canvasW, sideMinFromCenter) {
  return position === "left"
    ? Math.min(sideInset, canvasW / 2 - sideMinFromCenter)
    : Math.max(canvasW - sideInset, canvasW / 2 + sideMinFromCenter);
}
