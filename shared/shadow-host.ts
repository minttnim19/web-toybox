// A full-screen, click-through host element with its own Shadow DOM, so widget UI
// can't be affected by (or affect) the host page's CSS.

export interface ShadowHost {
  host: HTMLElement;
  root: ShadowRoot;
  destroy(): void;
}

/**
 * Create the host. It is attached to <html> (outside <body>) so effects applied to
 * the page body — filters, transforms, visibility — never reach the widget.
 */
export function createShadowHost(name: string, css: string): ShadowHost {
  const host = document.createElement(`web-toybox-${name}`);
  host.setAttribute('data-wd-ignore', '');
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'inset: 0',
    'z-index: 2147483647',
    'pointer-events: none',
    'display: block',
    'visibility: visible',
    'contain: layout style',
  ]
    .map((rule) => `${rule} !important`)
    .join(';');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  root.append(style);
  document.documentElement.append(host);
  return { host, root, destroy: () => host.remove() };
}

/** Elements inside the shadow host (or the host itself) took part in this event. */
export function eventInHost(event: Event, host: Element): boolean {
  return event.composedPath().includes(host);
}
