// Read an element's real colors so it can shatter into matching pixel blocks.
import {
  borderInfo,
  extractColors,
  hasOwnText,
  normalizeColor,
  type StylableElement,
} from '../../../shared/dom';

/** Returns a color for a point inside the element, given as fractions (0..1) of its size. */
export type ColorSampler = (fx: number, fy: number) => string;

const FALLBACK = ['#8b9bb4', '#5d6b85', '#c2c3c7'];
const IMG_GRID = 8;

/** Sample an image into a small grid. Fails silently on cross-origin (tainted) images. */
function sampleImage(img: HTMLImageElement): string[] | null {
  if (!img.complete || img.naturalWidth === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = IMG_GRID;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, IMG_GRID, IMG_GRID);
    const data = ctx.getImageData(0, 0, IMG_GRID, IMG_GRID).data;
    const out: string[] = [];
    for (let i = 0; i < data.length; i += 4) {
      out.push(
        `rgba(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${(data[i + 3]! / 255).toFixed(2)})`,
      );
    }
    return out;
  } catch {
    return null;
  }
}

export function makeColorSampler(el: StylableElement): ColorSampler {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const background = normalizeColor(style.backgroundColor);
  const stops = style.backgroundImage.includes('gradient')
    ? extractColors(style.backgroundImage)
    : [];
  const border = borderInfo(style);
  const svgPaint =
    el instanceof SVGElement ? normalizeColor(style.fill) || normalizeColor(style.stroke) : null;
  const text = normalizeColor(style.color);
  const hasText =
    hasOwnText(el) ||
    el instanceof SVGElement ||
    el.localName === 'input' ||
    el.localName === 'textarea';
  const image = el instanceof HTMLImageElement ? sampleImage(el) : null;

  return (fx, fy) => {
    if (image) {
      const gx = Math.min(IMG_GRID - 1, Math.floor(fx * IMG_GRID));
      const gy = Math.min(IMG_GRID - 1, Math.floor(fy * IMG_GRID));
      return image[gy * IMG_GRID + gx]!;
    }
    if (border.color) {
      const px = fx * rect.width;
      const py = fy * rect.height;
      if (
        px < border.left ||
        py < border.top ||
        rect.width - px < border.right ||
        rect.height - py < border.bottom
      )
        return border.color;
    }
    if (text && hasText && Math.random() < 0.3) return text;
    if (stops.length > 0) {
      // Rough position along the gradient: diagonal works well for most gradients.
      const t = Math.min(1, Math.max(0, (fx + fy) / 2));
      return stops[Math.round(t * (stops.length - 1))]!;
    }
    if (background) return background;
    if (svgPaint) return svgPaint;
    if (text) return text;
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)]!;
  };
}
