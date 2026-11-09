// Fonts must be declared in the main document to be usable inside Shadow DOM.

export const PIXEL_FONT = "'Press Start 2P', ui-monospace, Menlo, monospace";
export const THAI_FONT = "'Kanit', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif";

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Press+Start+2P&display=swap';

/** Inject the Google Fonts stylesheet once. Fallback fonts are used if it fails to load. */
export function ensureFonts(): void {
  if (document.querySelector('link[data-web-toybox-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_URL;
  link.dataset.webToyboxFonts = '';
  document.head.append(link);
}
