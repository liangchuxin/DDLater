/** Build lab preview: active furniture (draft) + optional room placeholders from catalog. */

const GHOST_MEMBER = { isOnline: true, activeAvatar: null };

function addSidePlaceholder(layout, catalogFurnitures, position, furnitureKey, userId) {
  const furniture = catalogFurnitures.find((f) => f.key === furnitureKey);
  if (!furniture) return;
  layout.push({
    userId,
    furniture,
    slotIndex: 0,
    position,
    member: GHOST_MEMBER,
  });
}

export function buildLabPreviewLayout({
  activeFurniture,
  activePosition,
  previewMembersBySlot = {},
  catalogFurnitures = [],
  isCenterMultiSeat = false,
  roomContext = false,
}) {
  if (!activeFurniture) return [];

  const desk = catalogFurnitures.find((f) => f.key === "desk");
  const bed = catalogFurnitures.find((f) => f.key === "bed");

  const memberForSlot = (slotIndex) =>
    previewMembersBySlot[slotIndex] ?? GHOST_MEMBER;

  if (isCenterMultiSeat) {
    const capacity = Math.max(1, activeFurniture.capacity ?? 2);
    const layout = [];

    addSidePlaceholder(layout, catalogFurnitures, "left", "bean_bag", "ph-bean-left");
    layout.push(
      ...Array.from({ length: capacity }, (_, slotIndex) => ({
        userId: `preview-${slotIndex}`,
        furniture: activeFurniture,
        slotIndex,
        position: "center",
        member: memberForSlot(slotIndex),
      })),
    );
    addSidePlaceholder(layout, catalogFurnitures, "right", "bed", "ph-bed-right");

    return layout;
  }

  if (!roomContext) {
    const side = activePosition === "right" ? "right" : "left";
    return [
      {
        userId: "preview",
        furniture: activeFurniture,
        slotIndex: 0,
        position: side,
        member: memberForSlot(0),
      },
    ];
  }

  const layout = [];

  const addDeskCenter = () => {
    if (!desk) return;
    layout.push(
      {
        userId: "ph-desk-0",
        furniture: desk,
        slotIndex: 0,
        position: "center",
        member: GHOST_MEMBER,
      },
      {
        userId: "ph-desk-1",
        furniture: desk,
        slotIndex: 1,
        position: "center",
        member: GHOST_MEMBER,
      },
    );
  };

  const addBed = (position, id) => {
    if (!bed) return;
    layout.push({
      userId: id,
      furniture: bed,
      slotIndex: 0,
      position,
      member: GHOST_MEMBER,
    });
  };

  const addActive = (position) => {
    layout.push({
      userId: "preview",
      furniture: activeFurniture,
      slotIndex: 0,
      position,
      member: memberForSlot(0),
    });
  };

  if (activePosition === "left") {
    addActive("left");
    addDeskCenter();
    addBed("right", "ph-bed-right");
  } else if (activePosition === "right") {
    addBed("left", "ph-bed-left");
    addDeskCenter();
    addActive("right");
  } else if (activePosition === "center") {
    addBed("left", "ph-bed-left");
    addActive("center");
    addBed("right", "ph-bed-right");
  }

  return layout;
}
