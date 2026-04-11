// 像素小人 SVG 组件，所有 task card 共用
// head/body/leg 传色值，eye 默认金色
export default function PixelRobot({
  head = '#265c2e',
  body = '#37753f',
  leg = '#1e4824',
  eye = '#dfc070',
  width = 74,
  height = 92,
  opacity = 1,
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 13 17"
      style={{ imageRendering: 'pixelated', position: 'relative', zIndex: 1, opacity }}
    >
      <rect x="3" y="0" width="7" height="5" fill={head} />
      <rect x="2" y="5" width="9" height="7" fill={body} />
      <rect x="1" y="7" width="2" height="3" fill={body} />
      <rect x="10" y="7" width="2" height="3" fill={body} />
      <rect x="3" y="12" width="3" height="4" fill={leg} />
      <rect x="6" y="12" width="3" height="4" fill={leg} />
      <rect x="4" y="1" width="1" height="1" fill={eye} />
      <rect x="8" y="1" width="1" height="1" fill={eye} />
    </svg>
  );
}
