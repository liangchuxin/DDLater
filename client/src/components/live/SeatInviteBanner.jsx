import { useEffect, useState } from "react";
import PixelBox from "../PixelBox";

const PIXEL = 3;

/** 5×5 grid of 3px tiles — matches PixelBox border width */
function PixelCheckIcon({ className }) {
  const p = PIXEL;
  const blocks = [
    [0, 2],
    [1, 3],
    [2, 2],
    [3, 1],
  ];
  return (
    <svg
      className={className}
      viewBox="0 0 15 15"
      aria-hidden="true"
    >
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
    </svg>
  );
}

function PixelCrossIcon({ className }) {
  const p = PIXEL;
  const blocks = [
    [1, 1],
    [2, 2],
    [3, 3],
    [3, 1],
    [1, 3],
  ];
  return (
    <svg
      className={className}
      viewBox="0 0 15 15"
      aria-hidden="true"
    >
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
    </svg>
  );
}

export default function SeatInviteBanner({
  fromName,
  onAccept,
  onDecline,
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <PixelBox
      variant="retro"
      className={`live-invite-banner${entered ? " is-visible" : ""}`}
      role="dialog"
      aria-live="polite"
      aria-label="Seat swap invitation"
    >
      <p className="live-invite-banner-text">
        <strong>{fromName}</strong> wants to switch seats?
      </p>
      <div className="live-invite-banner-actions">
        <PixelBox
          as="button"
          type="button"
          variant="retro"
          className="live-invite-banner-btn is-accept"
          aria-label="Accept seat swap"
          onClick={onAccept}
        >
          <PixelCheckIcon className="live-invite-banner-icon" />
        </PixelBox>
        <PixelBox
          as="button"
          type="button"
          variant="retro"
          className="live-invite-banner-btn is-decline"
          aria-label="Decline seat swap"
          onClick={onDecline}
        >
          <PixelCrossIcon className="live-invite-banner-icon" />
        </PixelBox>
      </div>
    </PixelBox>
  );
}
