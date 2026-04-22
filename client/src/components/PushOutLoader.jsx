import "../styles/PushOutLoader.css";

// Push-out loader,原作者 jh3y (codepen)。
// SCSS 里所有数字都是基于 100×100 的 base 写死的,要换尺寸最简单是外层 scale。
// wrap div 负责 layout 尺寸 (= size prop),内层 .push-out 用 transform: scale 视觉缩放。
// 颜色: 传 color prop,或在外层用 --push-out-color CSS var 覆盖。
export default function PushOutLoader({ color, size = 50 }) {
  const scale = size / 100;
  return (
    <div
      className="push-out-wrap"
      style={{
        width: size,
        height: size,
        ...(color ? { "--push-out-color": color } : {}),
      }}
    >
      <div
        className="push-out"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div />
        <div />
      </div>
    </div>
  );
}
