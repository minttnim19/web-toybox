// CSS for everything inside the widget's Shadow DOM: chunky pixel boxes, thick borders,
// hard drop shadows, no rounded corners.
import { PIXEL_FONT, THAI_FONT } from '../../../shared/fonts';
import { PALETTE as C } from '../render/sprites';

const safe = (side: 'top' | 'right' | 'bottom' | 'left', px: number) =>
  `calc(${px}px + env(safe-area-inset-${side}))`;

export const WIDGET_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.game-canvas {
  position: fixed;
  left: 0;
  top: 0;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  pointer-events: none;
}

.px { font-family: ${PIXEL_FONT}; line-height: 1.2; }
.th { font-family: ${THAI_FONT}; line-height: 1.5; }
img.icon { image-rendering: pixelated; display: block; }

/* Buttons */
.px-btn {
  pointer-events: auto;
  cursor: pointer;
  font-family: ${PIXEL_FONT};
  font-size: 12px;
  line-height: 1.2;
  color: ${C.navy};
  background: ${C.yellow};
  border: 3px solid ${C.navy};
  border-radius: 0;
  box-shadow: 4px 4px 0 ${C.navy};
  padding: 10px 12px;
  margin: 0;
  -webkit-tap-highlight-color: transparent;
  transition: transform 80ms steps(2), box-shadow 80ms steps(2);
}
.px-btn.th { font-family: ${THAI_FONT}; font-weight: 600; font-size: 15px; padding: 8px 14px; }
.px-btn:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 ${C.navy}; }
.px-btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 ${C.navy}; }
.px-btn:focus-visible { outline: 3px solid ${C.cyan}; outline-offset: 2px; }
.px-btn.pink { background: ${C.pink}; color: ${C.white}; text-shadow: 2px 2px 0 ${C.navy}; }
.px-btn.light { background: ${C.white}; }

.launcher {
  position: fixed;
  background: ${C.pink};
  color: ${C.white};
  font-size: 13px;
  padding: 12px 14px;
  text-shadow: 2px 2px 0 ${C.navy};
}
.launcher[data-pos='bottom-right'] { right: ${safe('right', 16)}; bottom: ${safe('bottom', 16)}; }
.launcher[data-pos='bottom-left'] { left: ${safe('left', 16)}; bottom: ${safe('bottom', 16)}; }
.launcher[data-pos='top-right'] { right: ${safe('right', 16)}; top: ${safe('top', 16)}; }
.launcher[data-pos='top-left'] { left: ${safe('left', 16)}; top: ${safe('top', 16)}; }

/* Overlay panels (menu, result) */
.backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: ${safe('top', 16)} ${safe('right', 16)} ${safe('bottom', 16)} ${safe('left', 16)};
  background: rgba(26, 28, 44, 0.55);
  pointer-events: auto;
  cursor: default;
  overflow-y: auto;
}
.panel {
  position: relative;
  width: min(460px, 100%);
  padding: 24px 22px 22px;
  background: ${C.navy};
  color: ${C.white};
  border: 4px solid ${C.white};
  box-shadow: 8px 8px 0 #000;
  animation: pop 160ms steps(3);
}
.panel h2 {
  margin: 0 0 14px;
  font-family: ${PIXEL_FONT};
  font-size: 22px;
  color: ${C.yellow};
  text-shadow: 3px 3px 0 ${C.pink};
  text-align: center;
}
.panel .close {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 6px 8px;
  font-size: 10px;
  box-shadow: 2px 2px 0 #000;
}
.panel ul.howto { margin: 0 0 16px; padding-left: 20px; font-size: 14px; }
.panel ul.howto li { margin: 2px 0; }
.section-label {
  margin: 14px 0 8px;
  font-family: ${PIXEL_FONT};
  font-size: 10px;
  color: ${C.cyan};
}
.item-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; padding: 0; list-style: none; }
.item-list li { display: flex; gap: 8px; align-items: center; font-size: 13px; line-height: 1.3; }
.item-list li img { width: 36px; height: 36px; flex: none; }
.item-list b { display: block; font-size: 14px; color: ${C.yellow}; font-weight: 600; }
.choices { display: flex; gap: 10px; }
.choices .px-btn { flex: 1; background: ${C.white}; box-shadow: 3px 3px 0 #000; }
.choices .px-btn[aria-pressed='true'] { background: ${C.cyan}; }
.start { display: block; width: 100%; margin-top: 18px; font-size: 18px !important; padding: 12px !important; }

/* Countdown */
.countdown {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.countdown span {
  font-family: ${PIXEL_FONT};
  font-size: clamp(64px, 18vw, 160px);
  color: ${C.yellow};
  text-shadow: 6px 6px 0 ${C.pink}, 12px 12px 0 ${C.navy};
  animation: count 700ms steps(6) both;
}

/* HUD: top bar */
.hud-top {
  position: fixed;
  top: ${safe('top', 10)};
  left: ${safe('left', 10)};
  right: ${safe('right', 10)};
  display: flex;
  gap: 8px;
  align-items: stretch;
  pointer-events: none;
}
.box {
  background: ${C.navy};
  color: ${C.white};
  border: 3px solid ${C.white};
  box-shadow: 4px 4px 0 #000;
  padding: 6px 10px;
  font-family: ${PIXEL_FONT};
  font-size: 11px;
}
.box .label { display: block; font-size: 8px; color: ${C.cyan}; margin-bottom: 4px; }
.progress { flex: 1; min-width: 110px; max-width: 320px; }
.bar { height: 8px; margin-top: 4px; background: #000; border: 2px solid ${C.white}; }
.bar i { display: block; height: 100%; width: 0; background: ${C.green}; }
.time.low .value { color: ${C.pink}; animation: blink 0.6s steps(1) infinite; }
.combo .value { color: ${C.yellow}; }
.spacer { flex: 1; }
.hud-top .px-btn { font-size: 10px; padding: 6px 9px; box-shadow: 3px 3px 0 #000; }
.hud-top .px-btn.th { font-size: 14px; padding: 4px 10px; }

/* HUD: bottom (buffs + item slots) */
.hud-bottom {
  position: fixed;
  left: 50%;
  bottom: ${safe('bottom', 12)};
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.buffs { display: flex; gap: 6px; }
.buff { display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 4px; font-size: 10px; }
.buff img { width: 24px; height: 24px; }
.slots { position: relative; display: flex; gap: 8px; }
.slot {
  pointer-events: auto;
  cursor: pointer;
  position: relative;
  width: 54px;
  height: 54px;
  padding: 0;
  display: grid;
  place-items: center;
  background: rgba(26, 28, 44, 0.85);
  border: 3px solid ${C.white};
  box-shadow: 3px 3px 0 #000;
  border-radius: 0;
  -webkit-tap-highlight-color: transparent;
}
.slot img { width: 36px; height: 36px; }
.slot .key {
  position: absolute;
  left: 2px;
  top: 2px;
  font-family: ${PIXEL_FONT};
  font-size: 8px;
  color: ${C.cyan};
}
.slot:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #000; }
.full {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-family: ${PIXEL_FONT};
  font-size: 9px;
  color: ${C.pink};
  text-shadow: 1px 1px 0 #000;
}

/* Result */
.result h2 { font-size: 28px; }
.result h2.timeup { color: ${C.pink}; text-shadow: 3px 3px 0 ${C.purple}; }
.stats { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 15px; }
.stats td { padding: 5px 0; border-bottom: 2px dashed rgba(244, 244, 244, 0.15); }
.stats td:last-child { text-align: right; font-family: ${PIXEL_FONT}; font-size: 12px; }
.stats tr.total td:last-child { font-size: 16px; color: ${C.yellow}; }
.new { margin-left: 6px; color: ${C.pink}; animation: blink 0.5s steps(1) infinite; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions .px-btn { flex: 1; }

@keyframes pop { from { transform: scale(0.85); } to { transform: none; } }
@keyframes count { 0% { transform: scale(1.8); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.85; } }
@keyframes blink { 50% { visibility: hidden; } }

@media (max-width: 560px) {
  .hud-top { gap: 5px; flex-wrap: wrap; }
  .box { padding: 4px 6px; font-size: 9px; border-width: 2px; box-shadow: 2px 2px 0 #000; }
  .box .label { font-size: 7px; margin-bottom: 2px; }
  .progress { min-width: 0; flex-basis: 100%; max-width: none; order: 10; }
  .hud-top .px-btn { font-size: 9px; padding: 4px 6px; }
  .hud-top .px-btn.th { font-size: 13px; padding: 2px 8px; }
  .slot { width: 50px; height: 50px; }
  .item-list { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
`;
