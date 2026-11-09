// CSS for everything inside the widget's Shadow DOM: chunky pixel boxes, thick borders,
// hard drop shadows, no rounded corners.
import { PIXEL_FONT, THAI_FONT } from '../../../shared/fonts';
import { PALETTE } from '../render/sprites';

export const WIDGET_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

.game-canvas {
  position: fixed;
  left: 0;
  top: 0;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  pointer-events: none;
}

.px-btn {
  pointer-events: auto;
  cursor: pointer;
  font-family: ${PIXEL_FONT};
  font-size: 12px;
  line-height: 1;
  color: ${PALETTE.navy};
  background: ${PALETTE.yellow};
  border: 3px solid ${PALETTE.navy};
  border-radius: 0;
  box-shadow: 4px 4px 0 ${PALETTE.navy};
  padding: 10px 12px;
  margin: 0;
  -webkit-tap-highlight-color: transparent;
  transition: transform 80ms steps(2), box-shadow 80ms steps(2);
}
.px-btn:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 ${PALETTE.navy}; }
.px-btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 ${PALETTE.navy}; }
.px-btn:focus-visible { outline: 3px solid ${PALETTE.cyan}; outline-offset: 2px; }
.th { font-family: ${THAI_FONT}; font-weight: 600; font-size: 14px; }

.launcher {
  position: fixed;
  background: ${PALETTE.pink};
  color: ${PALETTE.white};
  font-size: 13px;
  padding: 12px 14px;
  text-shadow: 2px 2px 0 ${PALETTE.navy};
}
.launcher[data-pos='bottom-right'] { right: calc(16px + env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); }
.launcher[data-pos='bottom-left'] { left: calc(16px + env(safe-area-inset-left)); bottom: calc(16px + env(safe-area-inset-bottom)); }
.launcher[data-pos='top-right'] { right: calc(16px + env(safe-area-inset-right)); top: calc(16px + env(safe-area-inset-top)); }
.launcher[data-pos='top-left'] { left: calc(16px + env(safe-area-inset-left)); top: calc(16px + env(safe-area-inset-top)); }

.quit {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top));
  right: calc(12px + env(safe-area-inset-right));
  background: ${PALETTE.white};
  padding: 8px 10px;
}

[hidden] { display: none !important; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
`;
