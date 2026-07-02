import { useEffect, useMemo, useState } from "react";
import PixelBox from "../PixelBox";
import { assetUrl } from "./roomConfig";

function PixelIcon({ children, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 15 15"
      width={15}
      height={15}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function FurnitureIcon({ className }) {
  const p = 3;
  const blocks = [
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
    [0, 3],
    [4, 3],
    [1, 2],
    [2, 2],
    [3, 2],
    [1, 1],
    [3, 1],
  ];
  return (
    <PixelIcon className={className}>
      {blocks.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * p}
          y={row * p}
          width={p}
          height={p}
          fill="currentColor"
        />
      ))}
    </PixelIcon>
  );
}

function EmojiIcon({ className }) {
  const p = 3;
  const blocks = [
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [4, 1],
    [0, 2],
    [4, 2],
    [0, 3],
    [4, 3],
    [1, 4],
    [2, 4],
    [3, 4],
    [1, 2],
    [3, 2],
    [2, 3],
  ];
  return (
    <PixelIcon className={className}>
      {blocks.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * p}
          y={row * p}
          width={p}
          height={p}
          fill="currentColor"
        />
      ))}
    </PixelIcon>
  );
}

function OutfitIcon({ className }) {
  const p = 3;
  const blocks = [
    [2, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [1, 4],
    [3, 4],
  ];
  return (
    <PixelIcon className={className}>
      {blocks.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * p}
          y={row * p}
          width={p}
          height={p}
          fill="currentColor"
        />
      ))}
    </PixelIcon>
  );
}

const TOOLBAR_ITEMS = [
  { id: "furniture", label: "Furniture", Icon: FurnitureIcon },
  { id: "emoji", label: "Emoji", Icon: EmojiIcon },
  { id: "appearance", label: "Outfit", Icon: OutfitIcon },
];

function FurnitureThumb({ furniture }) {
  const keys = furniture.imageKeys ?? [];
  if (keys.length === 0) {
    return <span className="live-scene-toolbar-furniture-fallback" />;
  }
  if (keys.length === 1) {
    return (
      <img
        src={assetUrl(keys[0])}
        alt=""
        draggable={false}
        className="live-scene-toolbar-furniture-thumb"
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
          className="live-scene-toolbar-furniture-thumb-layer"
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

  const swapOptions = useMemo(() => {
    const seatCapacity = placement?.startsWith("desk-") ? 2 : 1;
    return furnitures.filter((f) => {
      if (!allowedFurnitureKeys.includes(f.key)) return false;
      if ((f.capacity ?? 1) !== seatCapacity) return false;
      if (f.key === currentFurnitureKey) return false;
      return true;
    });
  }, [furnitures, allowedFurnitureKeys, placement, currentFurnitureKey]);

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

      {openPanel === "furniture" && swapOptions.length > 0 && (
        <PixelBox
          variant="retro"
          className="live-scene-toolbar-panel is-furniture"
        >
          <div className="live-scene-toolbar-furniture-grid">
            {swapOptions.map((f) => (
              <button
                key={f.key}
                type="button"
                className="live-scene-toolbar-furniture-item"
                disabled={changingFurniture}
                aria-label={f.name ?? f.key}
                onClick={() => onFurnitureChange?.(f.key)}
              >
                <FurnitureThumb furniture={f} />
              </button>
            ))}
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
