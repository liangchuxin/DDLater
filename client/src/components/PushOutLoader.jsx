import "../styles/PushOutLoader.css";

// Push-out loader by jh3y (codepen).
// All numbers in the SCSS are hardcoded against a 100x100 base; easiest way to resize
// is to scale the outer wrapper. The wrap div owns layout size (= size prop); the
// inner .push-out uses transform: scale for visual scaling.
// Color: pass the color prop, or override --push-out-color on the outer element.
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
