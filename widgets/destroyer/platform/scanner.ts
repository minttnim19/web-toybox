// Scan the page for destructible targets and assign them stable IDs in DOM order.
import { hasVisibleBox, isStylable, type StylableElement } from '../../../shared/dom';
import type { TargetSpec } from '../core/state';

/** Elements that count as targets because of what they are, regardless of styling. */
const CONTENT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'img', 'svg', 'input', 'textarea',
  'select', 'label', 'li', 'dt', 'dd', 'td', 'th', 'caption', 'blockquote', 'figcaption', 'pre',
  'summary', 'video', 'canvas', 'iframe', 'picture', 'progress', 'meter',
]); // prettier-ignore

/** Never targets, and never descended into. */
const SKIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'noscript', 'template', 'head', 'title', 'br', 'wbr',
  'source', 'track', 'option', 'optgroup', 'datalist', 'slot', 'object', 'embed',
]); // prettier-ignore

/** Targets whose insides are treated as part of them. */
const LEAF_TAGS = new Set([
  'svg',
  'img',
  'picture',
  'video',
  'canvas',
  'iframe',
  'select',
  'textarea',
  'input',
]);

export const MIN_TARGET_SIZE = 6;

export interface ScannedTarget extends TargetSpec {
  el: StylableElement;
}

/**
 * Walk `scope` (excluding the scope element itself) in DOM order.
 * IDs are assigned in pre-order so the same page yields the same IDs on every machine.
 */
export function scanTargets(scope: Element, exclude: Element | null): ScannedTarget[] {
  const targets: ScannedTarget[] = [];
  const childCount: number[] = [];

  const visit = (el: Element, parentId: number | null): void => {
    const tag = el.localName;
    if (SKIP_TAGS.has(tag) || el === exclude || !isStylable(el)) return;
    if (el.dataset.wdIgnore !== undefined) return; // data-wd-ignore

    const style = getComputedStyle(el);
    if (style.display === 'none' || parseFloat(style.opacity) === 0) return; // whole subtree invisible

    let id = parentId;
    const visible = style.visibility === 'visible' && style.display !== 'contents';
    if (visible && (CONTENT_TAGS.has(tag) || hasVisibleBox(style))) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= MIN_TARGET_SIZE && rect.height >= MIN_TARGET_SIZE) {
        id = targets.length;
        targets.push({ id, parentId, area: rect.width * rect.height, isContainer: false, el });
        childCount.push(0);
        if (parentId !== null) childCount[parentId]!++;
      }
    }

    if (LEAF_TAGS.has(tag) && id !== parentId) return;
    for (const child of el.children) visit(child, id);
  };

  for (const child of scope.children) visit(child, null);
  for (const t of targets) t.isContainer = childCount[t.id]! > 0;
  return targets;
}

/** Resolve the scope selector, falling back to <body> with a warning. */
export function resolveScope(selector: string): Element {
  try {
    const el = document.querySelector(selector);
    if (el) return el;
    console.warn(`[destroyer] data-scope "${selector}" matched nothing, using body.`);
  } catch {
    console.warn(`[destroyer] data-scope "${selector}" is not a valid selector, using body.`);
  }
  return document.body;
}
