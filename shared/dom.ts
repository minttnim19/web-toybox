// DOM scanning and color utilities shared across widgets.

let colorCtx: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, string | null>();
const SENTINEL = '#010203';

/**
 * Normalize any CSS color the browser understands to "#rrggbb" or "rgba(r, g, b, a)".
 * Returns null for unsupported or fully transparent colors.
 */
export function normalizeColor(input: string): string | null {
  const key = input.trim();
  if (colorCache.has(key)) return colorCache.get(key)!;
  colorCtx ??= document.createElement('canvas').getContext('2d');
  let result: string | null = null;
  if (colorCtx && key && key !== 'transparent' && key !== 'none') {
    colorCtx.fillStyle = SENTINEL;
    colorCtx.fillStyle = key;
    const out = String(colorCtx.fillStyle);
    const unsupported = out === SENTINEL && key.toLowerCase() !== SENTINEL;
    if (!unsupported && colorAlpha(out) > 0) result = out;
  }
  colorCache.set(key, result);
  return result;
}

/** Alpha of a normalized color string. */
function colorAlpha(normalized: string): number {
  const m = /rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(normalized);
  return m ? parseFloat(m[1]!) : 1;
}

const COLOR_TOKEN =
  /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-fA-F]{3,8}\b|\b(?:white|black)\b/g;

/** Extract visible colors from a CSS value such as a gradient. */
export function extractColors(value: string): string[] {
  const out: string[] = [];
  for (const token of value.match(COLOR_TOKEN) ?? []) {
    const c = normalizeColor(token);
    if (c) out.push(c);
  }
  return out;
}

export interface BorderInfo {
  top: number;
  right: number;
  bottom: number;
  left: number;
  color: string | null;
}

/** Visible border widths and the first visible border color. */
export function borderInfo(style: CSSStyleDeclaration): BorderInfo {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const info: BorderInfo = { top: 0, right: 0, bottom: 0, left: 0, color: null };
  for (const side of sides) {
    const kind = style.getPropertyValue(`border-${side}-style`);
    const width = parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
    const color = normalizeColor(style.getPropertyValue(`border-${side}-color`));
    if (width > 0 && kind !== 'none' && kind !== 'hidden' && color) {
      info[side] = width;
      info.color ??= color;
    }
  }
  return info;
}

/** True when the element paints a background, gradient/image, or border of its own. */
export function hasVisibleBox(style: CSSStyleDeclaration): boolean {
  if (normalizeColor(style.backgroundColor)) return true;
  if (style.backgroundImage && style.backgroundImage !== 'none') return true;
  const b = borderInfo(style);
  return b.top + b.right + b.bottom + b.left > 0;
}

/** True when the element has non-whitespace text directly inside it. */
export function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

export type StylableElement = HTMLElement | SVGElement;

export function isStylable(el: Element): el is StylableElement {
  return el instanceof HTMLElement || el instanceof SVGElement;
}
