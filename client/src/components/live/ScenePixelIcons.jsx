/** 15×15 pixel icons for scene toolbar + avatar action menu. */

export function PixelIcon({ children, className }) {
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

function blocksToRects(blocks, p = 3) {
  return blocks.map(([col, row]) => (
    <rect
      key={`${col}-${row}`}
      x={col * p}
      y={row * p}
      width={p}
      height={p}
      fill="currentColor"
    />
  ));
}

export function FurnitureIcon({ className }) {
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
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

export function EmojiIcon({ className }) {
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
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

export function OutfitIcon({ className }) {
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
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

/** Horizontal swap / exchange arrows. */
export function SwapIcon({ className }) {
  const blocks = [
    [0, 2],
    [1, 2],
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 2],
    [4, 2],
    [3, 1],
    [3, 3],
  ];
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

/** Simple flower — invite. */
export function InviteIcon({ className }) {
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
    [3, 3],
    [2, 4],
  ];
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

/** Speech bubble — chat. */
export function ChatIcon({ className }) {
  const blocks = [
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [4, 1],
    [0, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [1, 4],
    [2, 4],
  ];
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}

/** Lucky bag (福袋) — gift. */
export function GiftIcon({ className }) {
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
    [0, 3],
    [4, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ];
  return <PixelIcon className={className}>{blocksToRects(blocks)}</PixelIcon>;
}
