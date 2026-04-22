// Pixel-art decorations around a box. Two variants:
//
// variant="plain" (default): 4 corner dots, consumer supplies the main box-shadow.
// variant="retro": full codepen-style frame — 10-layer box-shadow (bg extension +
//   border + hard drop shadow) plus 4 corner "ears" via two wrapper spans and
//   their pseudo elements. Consumer sets the colour variables and a matching
//   background; PixelBox owns the rest.

import '../styles/PixelBox.css';

export default function PixelBox({
  as: Tag = 'div',
  variant = 'plain',
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag className={`pixel-box pixel-box-${variant} ${className}`} {...rest}>
      {variant === 'plain' && (
        <>
          <span className="pixel-corner pixel-corner-tl" aria-hidden="true" />
          <span className="pixel-corner pixel-corner-tr" aria-hidden="true" />
          <span className="pixel-corner pixel-corner-bl" aria-hidden="true" />
          <span className="pixel-corner pixel-corner-br" aria-hidden="true" />
        </>
      )}
      {variant === 'retro' && (
        <>
          <span className="pixel-pt" aria-hidden="true" />
          <span className="pixel-pb" aria-hidden="true" />
        </>
      )}
      {children}
    </Tag>
  );
}
