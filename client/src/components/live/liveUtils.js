// Pure utility functions; no state.

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

// Read the dominant color from an img element; used for badge border/shadow.
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

// Randomly assign seats. Called once; result stays stable for the scene.
// Rules: self (memberIdx=0) sits randomly on the left/right desk slot; next
// member may take the other desk slot; remaining members go to side furniture.
export function generateSeats(memberCount, furnitures) {
  const desk = furnitures.find((f) => f.key === "desk");
  const pool = [...furnitures.filter((f) => f.key !== "desk")].sort(
    () => Math.random() - 0.5,
  );
  const selfDeskSlot = Math.random() < 0.5 ? 0 : 1;
  const sides = Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
  const seats = [];
  if (desk) {
    if (memberCount > 0)
      seats.push({
        memberIdx: 0,
        furniture: desk,
        slotIndex: selfDeskSlot,
        position: "center",
      });
    if (memberCount > 1)
      seats.push({
        memberIdx: 1,
        furniture: desk,
        slotIndex: 1 - selfDeskSlot,
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

// Extend existing seats without disturbing occupants.
// Strategy: fill empty desk slots first, then left/right side furniture.
// If everything is full, late arrivals aren't placed (capped at 4 seats in MVP).
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
    // 1) Take an open desk slot if available
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
    // 2) Left or right side, if available
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

// Side slot center x, clamped by sideInset (min distance from canvas edge) and
// sideMinFromCenter (min distance from canvas center). Prevents side furniture
// from overlapping the desk on narrow screens.
export function sideCenterX(position, sideInset, canvasW, sideMinFromCenter) {
  return position === "left"
    ? Math.min(sideInset, canvasW / 2 - sideMinFromCenter)
    : Math.max(canvasW - sideInset, canvasW / 2 + sideMinFromCenter);
}
