import { useEffect, useMemo, useState } from "react";
import PixelBox from "../PixelBox";
import { assetUrl } from "./roomConfig";
import { deriveFurnitureSpec } from "./furniture/furnitureTemplates";
import { EmojiIcon, FurnitureIcon, OutfitIcon } from "./ScenePixelIcons";

const TOOLBAR_ITEMS = [
  { id: "furniture", label: "Furniture", Icon: FurnitureIcon },
  { id: "emoji", label: "Emoji", Icon: EmojiIcon },
  { id: "appearance", label: "Outfit", Icon: OutfitIcon },
];

function FurnitureThumb({ furniture }) {
  const keys = furniture.imageKeys ?? [];
  const isCenter = deriveFurnitureSpec(furniture)?.slotType === "center";
  const thumbClass = isCenter
    ? "live-scene-toolbar-furniture-thumb is-center"
    : "live-scene-toolbar-furniture-thumb";
  if (keys.length === 0) {
    return <span className="live-scene-toolbar-furniture-fallback" />;
  }
  if (keys.length === 1) {
    return (
      <img
        src={assetUrl(keys[0])}
        alt=""
        draggable={false}
        className={thumbClass}
      />
    );
  }
  return (
    <span className="live-scene-toolbar-furniture-thumb-stack">
      {keys.map((key, index) => (
        <img
          key={key}
          src={assetUrl(key)}
          alt=""
          draggable={false}
          className={`live-scene-toolbar-furniture-thumb-layer${isCenter ? " is-center" : ""}`}
          style={{ zIndex: index + 1 }}
        />
      ))}
    </span>
  );
}

export default function SceneToolbar({
  furnitures = [],
  allowedFurnitureKeys = [],
  currentFurnitureKey,
  placement,
  onFurnitureChange,
  changingFurniture = false,
}) {
  const [openPanel, setOpenPanel] = useState(null);

  const furnitureOptions = useMemo(() => {
    const seatCapacity = placement?.startsWith("desk-") ? 2 : 1;
    return furnitures.filter((f) => {
      if (!allowedFurnitureKeys.includes(f.key)) return false;
      const spec = deriveFurnitureSpec(f);
      const capacity = spec?.capacity ?? f.capacity ?? 1;
      const slotType = spec?.slotType ?? f.slotType ?? "side";
      if (seatCapacity === 2) {
        if (slotType !== "center" || capacity < 2) return false;
      } else if (slotType === "center" || capacity > 1) {
        return false;
      }
      return true;
    });
  }, [furnitures, allowedFurnitureKeys, placement]);

  useEffect(() => {
    if (!openPanel) return undefined;
    const onDocClick = () => setOpenPanel(null);
    const t = window.setTimeout(
      () => document.addEventListener("click", onDocClick),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick);
    };
  }, [openPanel]);

  const togglePanel = (id) => {
    setOpenPanel((prev) => (prev === id ? null : id));
  };

  return (
    <div className="live-scene-toolbar" onClick={(e) => e.stopPropagation()}>
      <div className="live-scene-toolbar-btns">
        {TOOLBAR_ITEMS.map(({ id, label, Icon }) => (
          <PixelBox
            key={id}
            as="button"
            type="button"
            variant="retro"
            className={`live-scene-toolbar-btn${openPanel === id ? " is-active" : ""}`}
            aria-label={label}
            title={label}
            onClick={() => togglePanel(id)}
          >
            <Icon className="live-scene-toolbar-icon" />
          </PixelBox>
        ))}
      </div>

      {openPanel === "furniture" && furnitureOptions.length > 0 && (
        <PixelBox
          variant="retro"
          className="live-scene-toolbar-panel is-furniture"
        >
          <div className="live-scene-toolbar-furniture-grid">
            {furnitureOptions.map((f) => {
              const isCurrent = f.key === currentFurnitureKey;
              const label = f.name ?? f.key;
              if (isCurrent) {
                return (
                  <div
                    key={f.key}
                    className="live-scene-toolbar-furniture-item is-current"
                    aria-label={`${label} (in use)`}
                    aria-current="true"
                  >
                    <FurnitureThumb furniture={f} />
                  </div>
                );
              }
              return (
                <button
                  key={f.key}
                  type="button"
                  className="live-scene-toolbar-furniture-item"
                  disabled={changingFurniture}
                  aria-label={label}
                  onClick={() => onFurnitureChange?.(f.key)}
                >
                  <FurnitureThumb furniture={f} />
                </button>
              );
            })}
          </div>
        </PixelBox>
      )}

      {openPanel === "emoji" && (
        <PixelBox variant="retro" className="live-scene-toolbar-panel">
          <div className="live-scene-toolbar-panel-title">Emoji</div>
          <p className="live-scene-toolbar-panel-soon">
            Reactions over your character — coming soon.
          </p>
        </PixelBox>
      )}

      {openPanel === "appearance" && (
        <PixelBox variant="retro" className="live-scene-toolbar-panel">
          <div className="live-scene-toolbar-panel-title">Outfit</div>
          <p className="live-scene-toolbar-panel-soon">
            Clothes and accessories — coming soon.
          </p>
        </PixelBox>
      )}
    </div>
  );
}
